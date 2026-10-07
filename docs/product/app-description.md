Here I describe in general the idea of the app 'beside'.

It's a platform that mixes activity logging with social elements and RPG elements to create a new unique experience.

It's meant to enable friends to do activities with each other, not at the same time, necessarily, but the same activity nonetheless. Why they would use the app / platform is because we're thinking of cases where they're long-distance, meaning they don't live in the same city / country or share the same timezone.

By activities I mean stuff like reading a book, wathcing a TV show or movie, going to the gym, cooking, studying, building habits, ...etc. There are countless apps for people to log and track these activities, ours is meant to address the case where more than one person is doing the same activity.
Examples:
1. Reading the same book together.
2. Building a gym routine.
3. Watching the same movie / tv show.
4. Learning the same language.
5. Building the same habit.

Some activities will have a sense of accountability when done together, like habits and the gym. Others are just fun to do with someone else, like watching a tv show.

---

The most common case scenario as we see it is going to be with two people. They could be best friends or in a relationship, ...etc. However, we also want to support groups with more than two people.
This still isn't like social media where you can just send friend requests and befriend random people, this is for people who already know each other and talk outside of the platform. The main issue this platform addresses is the activity part, not the social part. Social elements, when introduced, are meant to serve and feed into the activity part.

---

Let's talk about those RPG elements I mentioned. Each user can have an avatar, with a name... etc. When two users who know each other decide to use the platform, a type of 'connection' is formed. Our idea is to have xp and levels but on the connection level, not the character level.
This is because one user can have connections with multiple real-life people where they share different interests. For example: A could share a connection with B that includes watching shows and reading books. And B can have a different connection with C where their activities are around cooking and drinking, which A doesn't share.
The idea behind levels and xp is to encourage the together aspect. For example, if one person goes regularly to the gym but the other doesn't, the former cannot carry both of them, this should encourage both people to be active in their decided activities.

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