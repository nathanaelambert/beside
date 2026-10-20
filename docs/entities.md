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
- deadline         TIME
- activity*        UUID [FK: activity.id]
- parent*          UUID [FK: milestone.id]

## reward
- id*              UUID [PK]
- homebase*        UUID [FK: homebase.id]
- type*            JSON
- attempted_in*    UUID [FK: milestone.id]
- obtained*        BOOL
- used_for         UUID [FK: milestone.id]

## log
- user*            UUID [FK: user.id]
- milestone*       UUID [FK: milestone.id]
- timestamp        TIME
- is_success       BOOL
- note             TEXT


# FAQ
## Q1. What is the typical flow of data?
Imagine a homebase with 3 users. The homebase has one obtained reward: a water bucket.
One of the user creates a new activity: reading a book.
On activity creation, a milestone is created for each chapter to read.
The book has 5 chapters. Each milestones gets a reward for instance: 
"fertile soil", "water bucket", "water bucket", "tree seed", "sapling".
Fertile soil and water buckets are rewards that require nothing. 
The sapling reward requires 1 fertile soil, 2 water buckets, and one tree seed.
When the activity is created users need to define which water bucket, soil, and seed will be used for the sapling.

// I'm unkappy with that mechanism
Watering shouldn't be a currency
nothing should be left as ingredient in a chest.

## Q2. How do we know which user is commited to which activity?
Activities use a milestone zero (is his own parent). 
Users join or decline an activity by loging a success/failure on milestone zero.
