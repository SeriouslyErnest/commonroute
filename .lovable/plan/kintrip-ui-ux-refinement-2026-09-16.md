# Kintrip UI/UX refinement

## Changes

- Prevent the floating phone navigation from covering the final controls or cards on every trip page.
- Strengthen the Tokyo trip-banner overlay and supporting text contrast while preserving the approved photography-led style.
- Simplify Discover with progressive place loading, a compact filter row, clearer selected votes, qualitative family-fit wording, and a cleaner completion action.
- Make Consensus calmer and easier to scan: use “Thoughtful planning,” show concise summaries by default, and reveal individual votes only on request.
- Quiet repeated completion labels on Family cards using accessible icon states, while keeping incomplete preferences prominent.
- Improve small supporting text contrast and use the larger desktop canvas more effectively without weakening the phone-first layout.
- Correct vote-label formatting and make completed versus upcoming planning steps visually distinct.

## Validation

- Check the empty setup, demo home, Discover, Consensus, and Family pages at phone and desktop sizes.
- Confirm expanded details, voting, filtering, progressive loading, navigation clearance, and page refreshes work without errors.
- Run the project type check.

## Technical details

- Keep the existing TanStack Start, Tailwind v4 tokens, current trip data, and interaction logic.
- Use semantic colour tokens and the existing Kintrip controls; no new services or data changes.
