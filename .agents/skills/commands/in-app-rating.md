# In-App Rating Command

Use this command guide for a generic in-app review implementation.

## Typical Trigger Model

- Track meaningful user actions (for example completed tasks/orders/trips).
- Trigger review request only after positive interaction.

## Recommended Throttling Rules

- Minimum completed actions threshold (for example 3)
- Minimum rating threshold (for example >= 4)
- Max prompt count per year (for example 3)
- Cool-down between prompts (for example 30 days)

## Suggested Persistent Keys

- `completedActionsCount`
- `lastReviewPromptAt`
- `reviewPromptCount`
- `userAlreadyRated`

## Integration

- Use platform in-app review APIs via `in_app_review` package.
- Request review from a single service (`AppReviewService`) to avoid duplicate prompts.

## Testing

- Reset review-related keys in debug builds.
- Validate suppression when thresholds are not met.
- Validate suppression during cool-down period.
