# Entities Relationship Model
*Format used: name(*mandatory) TYPE [PrimaryKey or ForeignKey]*

## user
- id*              UUID [PK]
- username*        TEXT
- email            TEXT

## homebase
- id*              UUID [PK]
- name*            TEXT

## user_homebase_map
- user*            [FK: user.id]
- homebase*        [FK: homebase.id]

## activity
- id*              UUID [PK]
- homebase*        UUID [FK: homebase.id]
- description      TEXT

## milestone
- id*              UUID [PK]
- activity*        UUID [FK: activity.id]
- parent*          UUID [FK: milestone.id]
- reward           UUID [FK: reward.id]
- start            TIME
- end              TIME

## log
- user*            UUID [FK: user.id]
- milestone*       UUID [FK: milestone.id]
- datetime         TIME
- is_success       BOOL
- note             TEXT

## reward
- id*              UUID [PK]
- homebase*        UUID [FK: homebase.id]
- type*            UUID [FK: reward_type.id]
- obtained*        BOOL
- sacrificed_for   UUID [FK: milestone.id]

## reward_type
- id*              UUID [PK]
- name*            TEXT
- category         TEXT
- artifact*        TEXT

# FAQ
## Q1. How do we know which user is commited to which activity?
Activities use a milestone zero (is his own parent). 
Users join or decline an activity by loging a success/failure on milestone zero.
## Q2. Are reward types only cosmetic ?
No ! Different reward types correspond to different logging policy. 
For instance:
| Type        | Logging Policy                      | Example usage |
|-------------|-------------------------------------|---------------|
| Plant       | Paced, can-skip, multi-milestones, collective-flexible   | going to the gym every day of the week |
| Decoration  | No deadline, single-milestone, individual                | beating your PersonalBest |
| Building    | Deadline, unpaced, multi-milestones, collective-flexible | Workout for 10h this week (each milestone=1h, can log them all on saturday in one crazy session) |
## Q3. What is a logging policy ?
It's a function that accepts or refuses a log given a milestone and the time when it is reported.
Examples: 
- a paced reward has a logging policy that refuses logs for a milestone that hasn't started yet.
- a deadline has a logging policy that refuses logs 
## Q4. What happens when a strict policy will refuse every log for future milestones ?