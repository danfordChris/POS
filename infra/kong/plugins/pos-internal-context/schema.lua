local typedefs = require "kong.db.schema.typedefs"

return {
  name = "pos-internal-context",
  fields = {
    { protocols = typedefs.protocols_http },
    { config = {
        type = "record",
        fields = {
          -- HS256 secret the access tokens are signed with (from `identity`).
          { jwt_secret = { type = "string", required = true, encrypted = true, referenceable = true } },
          -- HMAC key used to sign the internal context forwarded downstream.
          { internal_context_secret = { type = "string", required = true, encrypted = true, referenceable = true } },
          { internal_context_ttl = { type = "number", default = 60 } },
          -- true for `/v1/businesses/:businessId/*` — resolve + require membership.
          { require_business_scope = { type = "boolean", default = false } },
          { tenancy_membership_url = { type = "string", required = true } },
          { internal_api_key = { type = "string", required = true, encrypted = true, referenceable = true } },
          { membership_cache_ttl = { type = "number", default = 30 } },
        },
      },
    },
  },
}
