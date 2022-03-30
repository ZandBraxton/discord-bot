// Require the necessary discord.js classes
const { Client, Intents, MessageEmbed } = require("discord.js");
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    "GUILDS",
  ],
});
const config = require("./config.json");
const SQLite = require("better-sqlite3");
const sql = new SQLite("./scores.sqlite");

// When the client is ready, run this code (only once)
client.on("ready", () => {
  const Guilds = client.guilds.cache.map((guild) => guild.id);
  console.log(Guilds);
  // Check if the table "points" exists.
  const table = sql
    .prepare(
      "SELECT count(*) FROM sqlite_master WHERE type='table' AND name = 'scores';"
    )
    .get();
  if (!table["count(*)"]) {
    // If the table isn't there, create it and setup the database correctly.
    sql
      .prepare(
        "CREATE TABLE scores (id TEXT PRIMARY KEY, user TEXT, username TEXT, guild TEXT, points INTEGER);"
      )
      .run();
    // Ensure that the "id" row is always unique and indexed.
    sql.prepare("CREATE UNIQUE INDEX idx_scores_id ON scores (id);").run();
    sql.pragma("synchronous = 1");
    sql.pragma("journal_mode = wal");
  }

  // And then we have two prepared statements to get and set the score data.
  client.getScore = sql.prepare(
    "SELECT * FROM scores WHERE user = ? AND guild = ?"
  );
  client.setScore = sql.prepare(
    "INSERT OR REPLACE INTO scores (id, user, username, guild, points) VALUES (@id, @user, @username, @guild, @points);"
  );
  console.log("ready!");
});

// client.on("messageCreate", (message) => {
//   if (message.content.includes("sara jay")) {
//     message.reply({
//       content: "Did you mean triple h?",
//     });
//   }
// });

client.on("messageCreate", (message) => {
  if (message.author.bot) return;
  let score;
  const omegalulEmoji = message.guild.emojis.cache.find(
    (emoji) => emoji.name.toLocaleLowerCase() === "omegalul"
  );
  const missEmoji = message.guild.emojis.cache.find(
    (emoji) => emoji.name.toLocaleLowerCase === "acompletemiss"
  );

  if (message.guild) {
    score = client.getScore.get(message.author.id, message.guild.id);
    if (!score) {
      score = {
        id: `${message.guild.id}-${message.author.id}`,
        user: message.author.id,
        username: message.author.username,
        guild: message.guild.id,
        points: 1,
      };
    }
    const filter = (reaction, user) => {
      return ["omegalul", "acompletemiss"].includes(
        reaction.emoji.name.toLocaleLowerCase()
      );
    };

    message.awaitReactions({ filter, time: 20000 }).then((collected) => {
      collected.forEach((reaction) => {
        if (reaction.emoji.name.toLocaleLowerCase() === "omegalul") {
          score.points += reaction.count;
        } else {
          score.points -= reaction.count;
        }
        console.log(reaction.emoji.name);
      });

      if (score.points < 0) {
        score.points = 0;
      }

      client.setScore.run(score);
    });

    // const collector = message.createReactionCollector({ filter, time: 15000 });

    // collector.on("collect", (reaction, user) => {
    //   console.log(`Collected ${reaction.emoji.name} from ${user.tag}`);
    // });

    // collector.on("end", (collected) => {
    //   if (collected.size === 0) {
    //     console.log("lol");
    //     return;
    //   }

    //   collected.forEach((reaction) => {
    //     console.log(reaction.count);
    //     score.points += reaction.count;
    //   });

    //   client.setScore.run(score);
    // });

    // const reactions = message.reactions.cache;
    // console.log(typeof reactions);
    // setTimeout(() => {}, 1500);

    // message
    //   .awaitReactions({ filter, max: 1, time: 60000, errors: ["time"] })
    //   .then(() => {
    //     const reaction = collected.first();
    //     console.log(reaction);
    //   })
    //   .catch((collected) => {
    //     message.reply("hello");
    //   });
    // score.points++;
    // const curLevel = Math.floor(0.1 * Math.sqrt(score.points));
    // if (score.level < curLevel) {
    //   score.level++;
    //   message.reply(
    //     `You've leveled up to level **${curLevel}**! Ain't that dandy?`
    //   );
    // }
    client.setScore.run(score);
  }
  if (message.content.indexOf(config.prefix) !== 0) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();

  // Command-specific code here!
  if (command === "points") {
    return message.reply(`You currently have ${score.points} points!`);
  } // You can modify the code below to remove points from the mentioned user as well!
  if (command === "give") {
    // Limited to guild owner - adjust to your own preference!
    if (
      !message.member.roles.cache.some(
        (role) => role.name === "Mods" || role.name === "Jr Mod"
      )
    )
      return message.reply("Only mods can give points to other users");

    const user =
      message.mentions.users.first() || client.users.cache.get(args[0]);
    if (!user)
      return message.reply("You must mention someone or give their ID!");

    const pointsToAdd = parseInt(args[1], 10);
    if (!pointsToAdd)
      return message.reply("You didn't tell me how many points to give...");

    // Get their current points.
    let userScore = client.getScore.get(user.id, message.guild.id);

    // It's possible to give points to a user we haven't seen, so we need to initiate defaults here too!
    if (!userScore) {
      console.log("144");
      userScore = {
        id: `${message.guild.id}-${user.id}`,
        user: user.id,
        guild: message.guild.id,
        points: 0,
      };
    }
    userScore.points += pointsToAdd;

    // And we save it!
    client.setScore.run(userScore);

    return message.channel.send(
      `${user.tag} has received ${pointsToAdd} points and now stands at ${userScore.points} points.`
    );
  }

  if (command === "remove") {
    // Limited to guild owner - adjust to your own preference!
    if (
      !message.member.roles.cache.some(
        (role) => role.name === "Mods" || role.name === "Jr Mod"
      )
    )
      return message.reply("Only mods can remove points of other users");

    const user =
      message.mentions.users.first() || client.users.cache.get(args[0]);
    if (!user)
      return message.reply("You must mention someone or give their ID!");

    const pointsToRemove = parseInt(args[1], 10);
    if (!pointsToRemove)
      return message.reply("You didn't tell me how many points to remove...");

    // Get their current points.
    let userScore = client.getScore.get(user.id, message.guild.id);

    // It's possible to give points to a user we haven't seen, so we need to initiate defaults here too!
    if (!userScore) {
      console.log("HERE");
      userScore = {
        id: `${message.guild.id}-${user.id}`,
        user: user.id,
        guild: message.guild.id,
        points: 0,
      };
    }
    userScore.points -= pointsToRemove;
    if (userScore.points < 0) {
      userScore.points = 0;
    }

    // And we save it!
    client.setScore.run(userScore);

    return message.channel.send(
      `${user.tag} has lost ${pointsToRemove} points and now stands at ${userScore.points} points.`
    );
  }

  if (command === "check") {
    const user =
      message.mentions.users.first() || client.users.cache.get(args[0]);
    if (!user)
      return message.reply("You must mention someone or give their ID!");
    let userScore = client.getScore.get(user.id, message.guild.id);
    return message.channel.send(`${user.tag} has ${userScore.points} points`);
  }

  if (command === "help") {
    console.log(client.users.cache);
  }

  if (command === "leaderboard") {
    const top10 = sql
      .prepare(
        "SELECT * FROM scores WHERE guild = ? ORDER BY points DESC LIMIT 10;"
      )
      .all(message.guild.id);

    // Now shake it and show it! (as a nice embed, too!)
    const embed = new MessageEmbed()
      .setTitle("Leader board")
      .setAuthor({
        name: client.user.username,
        iconUrl: client.user.avatarURL(),
      })
      .setDescription("Our top 10 points leaders!")
      .setColor(0x00ae86);

    for (const data of top10) {
      console.log(top10);

      embed.addFields({
        name: data.username,
        value: `${data.points} points`,
      });
    }
    return message.channel.send({ embeds: [embed] });
  }
});

// Login to Discord with your client's token
client.login(config.token);
