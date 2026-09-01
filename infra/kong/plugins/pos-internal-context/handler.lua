-- pos-internal-context: edge auth for the POS platform.
--
--  1. verify the HS256 access token (signature + exp)
--  2. reject operator tokens on business-scoped routes
--  3. for /v1/businesses/:businessId/* resolve + require an active membership
--     (short-TTL cached call to tenancy's internal endpoint)
--  4. sign { request_id, user_id, business_id, role, token_kind } (HMAC-SHA256)
--     and forward it as X-Pos-Internal-Context / X-Pos-Internal-Signature
--
-- Failures are returned in the canonical envelope.
-- Uses only libraries bundled with Kong (jwt_parser from the jwt plugin,
-- resty.openssl.hmac, resty.http).

local cjson       = require "cjson.safe"
local jwt_parser  = require "kong.plugins.jwt.jwt_parser"
local openssl_hmac = require "resty.openssl.hmac"
local http        = require "resty.http"

local PosContext = {
  PRIORITY = 1000,
  VERSION  = "1.0.0",
}

local EMPTY_ARRAY = cjson.empty_array or setmetatable({}, { __index = {} })

local function b64url(bytes)
  return (ngx.encode_base64(bytes, true):gsub("=+$", ""))
end

local function hmac_sha256(key, msg)
  local h = assert(openssl_hmac.new(key, "sha256"))
  assert(h:update(msg))
  return h:final()
end

local function deny(status, code, message, dev)
  return kong.response.exit(status, {
    error = {
      code       = code,
      message    = message,
      devMessage = dev or message,
      details    = EMPTY_ARRAY,
    },
    requestId = kong.request.get_header("X-Request-Id") or "unknown",
  })
end

local function bearer_token()
  local h = kong.request.get_header("Authorization")
  if not h then return nil end
  return h:match("^[Bb]earer%s+(.+)$")
end

local function business_id_from_path()
  local path = kong.request.get_path()
  return path:match("^/v1/businesses/([0-9a-fA-F%-]+)")
end

local function resolve_membership(conf, business_id, user_id)
  local cache_key = "pos_membership:" .. business_id .. ":" .. user_id
  local function loader()
    local httpc = http.new()
    httpc:set_timeout(2000)
    local res, err = httpc:request_uri(conf.tenancy_membership_url, {
      method = "GET",
      query  = { business_id = business_id, user_id = user_id },
      headers = { ["X-Internal-Api-Key"] = conf.internal_api_key },
    })
    if not res then return nil, err end
    if res.status ~= 200 then return nil, "membership lookup status " .. res.status end
    return cjson.decode(res.body)
  end
  return kong.cache:get(cache_key, { ttl = conf.membership_cache_ttl }, loader)
end

function PosContext:access(conf)
  local token = bearer_token()
  if not token then
    return deny(401, "unauthenticated", "Please sign in and try again.", "missing bearer token")
  end

  local jwt, err = jwt_parser:new(token)
  if err then
    return deny(401, "unauthenticated", "Please sign in and try again.", "malformed token: " .. tostring(err))
  end
  if jwt.header.alg ~= "HS256" then
    return deny(401, "unauthenticated", "Please sign in and try again.", "unexpected alg " .. tostring(jwt.header.alg))
  end
  if not jwt:verify_signature(conf.jwt_secret) then
    return deny(401, "unauthenticated", "Please sign in and try again.", "bad signature")
  end
  local claims_ok, claims_err = jwt:verify_registered_claims({ "exp" })
  if not claims_ok then
    return deny(401, "unauthenticated", "Please sign in and try again.", "claims: " .. tostring(claims_err))
  end

  local claims   = jwt.claims or {}
  local audience = claims.aud
  if type(audience) == "table" then audience = audience[1] end
  local subject  = claims.sub
  if not subject then
    return deny(401, "unauthenticated", "Please sign in and try again.", "token has no subject")
  end

  local business_id = business_id_from_path()
  local role = nil

  if conf.require_business_scope then
    if audience == "operator" then
      return deny(403, "operator_data_access_denied",
        "Operator accounts cannot access business data.", "operator token on a data route")
    end
    if audience ~= "user" then
      return deny(403, "not_a_member", "You do not have access to this business.",
        "token audience is not 'user'")
    end
    if business_id then
      local m, merr = resolve_membership(conf, business_id, subject)
      if merr then
        return deny(503, "upstream_unavailable",
          "A service is temporarily unavailable. Please try again shortly.",
          "membership lookup failed: " .. tostring(merr))
      end
      if not m or not m.found or m.status ~= "active" then
        return deny(403, "not_a_member", "You do not have access to this business.", "no active membership")
      end
      role = m.role
    end
  end

  local now = ngx.time()
  local ctx = {
    request_id  = kong.request.get_header("X-Request-Id") or "unknown",
    user_id     = subject,
    business_id = business_id or cjson.null,
    role        = role or cjson.null,
    token_kind  = audience or "user",
    issued_at   = now,
    expires_at  = now + (conf.internal_context_ttl or 60),
  }
  local json = cjson.encode(ctx)

  kong.service.request.set_header("X-Pos-Internal-Context", b64url(json))
  kong.service.request.set_header("X-Pos-Internal-Signature", b64url(hmac_sha256(conf.internal_context_secret, json)))
end

return PosContext
