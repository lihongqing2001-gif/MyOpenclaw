# Self-Evolution Loop v1

## Objective
Continuously improve task success rate, speed, and reliability through closed-loop learning.

## Core Rule
No "done" claim without execution evidence.

## 7-Step Evolution Cycle
1. Intake
- Assign `request_id`, goal, DoD, risk level.

2. Plan
- Choose approach A/B and expected trade-offs.

3. Execute
- Run commands, produce files, keep trace.

4. Verify
- Read-back checks, smoke tests, and constraint validation.

5. Reflect
- Capture what failed, what worked, and why.

6. Update
- Update playbooks/templates/guards using concrete lessons.

7. Reuse
- Promote reusable patterns into knowledge layers.

## Metrics
- First-pass success rate
- Rework rate
- Time-to-delivery
- Regression incidents
- Policy/risk violations

## Triggered Improvements
- If same failure appears >= 2 times in 7 days, create a guard rule.
- If rework ratio > 20%, enforce a stricter preflight checklist.
- If delivery misses DoD, require mandatory postmortem.
