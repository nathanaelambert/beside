## beside
A mobile-first app mixing activity tracking, habit building, social elements, and RPG elements.
### Async-first
Beside is meant to enable friends to do activities with each other, not at the same time, necessarily, but the same activity nonetheless. 
it's optimized for long-distance friendships.
### diverse activity support
01. Reading the same book together.
02. Building a gym routine.
03. Watching the same movie / tv show.
04. Learning the same language.
05. Building the same habit.
06. Working on a Minecraft build together.
07. Writing a story together.
08. Running parallel DnD campaigns in a shared world and keeping each other updated.
09. Studying for the same exam together.
### multi-user shared space
Activities are shared in a virtual space by a group  of users.
A virtual shared space is called a homebase.
The app is optimized for homebases with two people (couples and friends).
The app supports larger homebases (3-5 people friend group, 8-15 people club, 25-30 people school class...).
### activity centered
Beside focuses on helping people who already know each other outside the platform do activities together.
Beside does not prioritize helping people meet strangers. 
Social elements, when introduced, are meant to serve and feed into the activity part.
### RPG and gamification
Each user has an avatar and a name in each of the homebase they are part of. 
Each homebase is independent. Progress in one homebase doesn't affect progress in another.


In terms of UI, we are thinking of a game-y kind of interface. Avatars and map made with pixel art. Interests, activities, ...etc can be shown as objects like islands, houses, and that "!" sign we see on NPCs on many games.
This could help with the separation of 'connections'. A and B could have a Reading 'island', this island shows the avatars of A and B. B can also navigate to the Cooking island, which they share with C.

---

I'm thinking of something like a regular profile for a user and a 'connection' profile for each connection. Therefore activities that are part of one connection do not mix with others in another connection or those independent of any connection.
I'm also thinking that the 'history' part should be key, so participating parties see what they did so far together in a timeline or collection, or even visually in the map, the level / xp number, or any similar approach.

---

For the social elements, I'm thinking they make most sense in a group of 3 or more, if for whatever reason one does not wish to interact with another but also not leave the group. Something like this could be utilized for intended mechanics like in-app games.

Speaking of games, I'm thinking that the app can have simple games that are there not for their own sake, but to feed into the activity aspect. For example, when both people log that they've watched movie X, they could then see that there's a 'Movie X trivia' game that they could play in, compete, and have scoring and a winner, ...etc

There could also be games of elimination, like a group of geography nerd friends playing a game of naming countries, with people of the group getting eliminated every round / wrong answer.

If it's not clear yet, the general experience should be async-first, but also support real-time features when two or more people happen to be online, like some of these games.

---

Speaking technical, I want flexibility in the data models. For example, I don't want to hard set activity types like reading and excercising, but making an 'Activity' primitive where users can define any activity they like. Reding and watching a movie could then just be common templates that are available, but not fixed.
