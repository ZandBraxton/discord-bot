// Require the necessary discord.js classes
const {
  Client,
  Intents,
  MessageEmbed,
  Interaction,
  MessageCollector,
  createMessageComponentCollector,
  MessageActionRow,
  MessageButton,
  MessageComponentInteraction,
} = require("discord.js");
const { v4: uuidv4 } = require("uuid");
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    "GUILDS",
  ],
});
// const config = require("./config.json");
require("dotenv").config();
const SQLite = require("better-sqlite3");
const sql = new SQLite("./scores.sqlite");
const { BetterDuel } = require("./duel");
let duelRunning = {};
const prestigeRequirement = 5000;

// When the client is ready, run this code (only once)
client.on("ready", () => {
  const Guilds = client.guilds.cache.map((guild) => guild.id);
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
        "CREATE TABLE scores (id TEXT PRIMARY KEY, user TEXT, username TEXT, guild TEXT, points INTEGER, prestige INTEGER);"
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
    "INSERT OR REPLACE INTO scores (id, user, username, guild, points, prestige) VALUES (@id, @user, @username, @guild, @points, @prestige);"
  );

  // client.updateScore = sql.prepare(

  // )
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
  if (
    message.channelId === "960715020898029588" ||
    message.channelId === "959230884475719760" ||
    message.channelId === "958465258178109530"
  ) {
    if (message.author.bot) return;
    let score;

    if (message.guild) {
      score = client.getScore.get(message.author.id, message.guild.id);
      let points = 0;
      // x = score.points;
      if (!score) {
        score = {
          id: `${message.guild.id}-${message.author.id}`,
          user: message.author.id,
          username: message.author.username,
          guild: message.guild.id,
          points: 1,
          prestige: 0,
        };
      }
      const filter = (reaction, user) => {
        return ["omegalul", "acompletemiss", "😭"].includes(
          reaction.emoji.name.toLocaleLowerCase()
        );
      };

      message.awaitReactions({ filter, time: 20000 }).then((collected) => {
        collected.forEach((reaction) => {
          if (reaction.emoji.name.toLocaleLowerCase() === "omegalul") {
            points += reaction.count * 2;
          } else if (reaction.emoji.name.toLocaleLowerCase() === "😭") {
            points += reaction.count;
          } else {
            points -= reaction.count;
          }
        });

        if (score.points < 0) {
          score.points = 0;
        }
        score = client.getScore.get(message.author.id, message.guild.id);
        score.points += points;

        client.setScore.run(score);
      });

      client.setScore.run(score);
    }
    if (message.content.indexOf(process.env.PREFIX) !== 0) return;

    const args = message.content
      .slice(process.env.PREFIX.length)
      .trim()
      .split(/ +/g);
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
        userScore = {
          id: `${message.guild.id}-${user.id}`,
          user: user.id,
          username: message.author.username,
          guild: message.guild.id,
          points: 0,
          prestige: 0,
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
        userScore = {
          id: `${message.guild.id}-${user.id}`,
          user: user.id,
          username: user.username,
          guild: message.guild.id,
          points: 0,
          prestige: 0,
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

    if (command === "drop") {
      // Limited to guild owner - adjust to your own preference!
      let clickedDrop = [];
      if (
        !message.member.roles.cache.some(
          (role) => role.name === "Mods" || role.name === "Jr Mod"
        )
      )
        return message.reply("Only mods can make drops");

      let amount = parseInt(args[0], 10);

      if (!amount || amount <= 0) {
        return message.reply("You need to specify the drop value");
      }
      let filter = (i) => !clickedDrop.includes(i.user.id);
      let claim = uuidv4();

      let row2 = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId(claim)
          .setLabel("Claim Points")
          .setStyle("SUCCESS")
      );

      message.channel.send({
        content: `${score.username} has created a drop of ${amount} points!`,
        maxComponents: 1,
        components: [row2],
      });

      const collector = message.channel.createMessageComponentCollector({
        filter,
        componentType: "BUTTON",
        time: 300000,
      });

      collector.on("collect", async (message) => {
        if (message.customId === claim) {
          clickedDrop.push(message.user.id);
          let userScore = client.getScore.get(
            message.user.id,
            message.guild.id
          );
          if (!userScore) {
            userScore = {
              id: `${message.guild.id}-${message.user.id}`,
              user: user.id,
              username: message.author.username,
              guild: message.guild.id,
              points: 0,
              prestige: 0,
            };
          }
          userScore.points += amount;
          client.setScore.run(userScore);
          message.channel.send(
            `${message.user.username} claimed ${amount} points, they now have ${userScore.points} points`
          );
        }
      });

      collector.on("end", (collected) => {
        message.reply("The drop has ended");
      });
    }

    if (command === "check") {
      const user =
        message.mentions.users.first() || client.users.cache.get(args[0]);
      if (!user)
        return message.reply("You must mention someone or give their ID!");
      let userScore = client.getScore.get(user.id, message.guild.id);
      if (!userScore) {
        userScore = {
          id: `${message.guild.id}-${user.id}`,
          user: user.id,
          username: user.username,
          guild: message.guild.id,
          points: 0,
          prestige: 0,
        };
        client.setScore.run(userScore);
      }
      return message.channel.send(`${user.tag} has ${userScore.points} points`);
    }

    if (command === "level") {
      const user =
        message.mentions.users.first() || client.users.cache.get(args[0]);
      if (!user)
        return message.reply("You must mention someone or give their ID!");
      let userScore = client.getScore.get(user.id, message.guild.id);
      if (!userScore) {
        userScore = {
          id: `${message.guild.id}-${user.id}`,
          user: user.id,
          username: user.username,
          guild: message.guild.id,
          points: 0,
          prestige: 0,
        };
        client.setScore.run(userScore);
      }
      return message.channel.send(
        `${user.tag} is prestige level ${userScore.prestige}`
      );
    }

    function ComparePoints() {
      const user =
        message.mentions.users.first() || client.users.cache.get(args[0]);
      if (!user) return undefined;
      // doesn't let you duel yourself
      if (user.id === message.author.id) {
        return undefined;
      }
      let authorScore = client.getScore.get(
        message.author.id,
        message.guild.id
      );
      let userScore = client.getScore.get(user.id, message.guild.id);
      if (!userScore) {
        userScore = {
          id: `${message.guild.id}-${user.id}`,
          user: user.id,
          username: user.username,
          guild: message.guild.id,
          points: 0,
          prestige: 0,
        };
        client.setScore.run(userScore);
      }
      return [authorScore, userScore];
    }

    function duelCheck(channelCheck) {
      duelRunning[channelCheck] = !duelRunning[channelCheck];
    }

    if (command === "compare") {
      let pointsArray = ComparePoints();
      if (pointsArray === undefined) {
        return message.reply("You must mention someone.");
      }
      return message.channel.send(
        `${pointsArray[0].username} has ${pointsArray[0].points} points, while ${pointsArray[1].username} has ${pointsArray[1].points} points.`
      );
    }

    if (command === "donate") {
      let amount = parseInt(args[1], 10);
      let pointsArray = ComparePoints();
      if (pointsArray === undefined) {
        return message.reply("You must mention someone or give their ID!");
      }
      let p1 = pointsArray[0];
      let p2 = pointsArray[1];
      if (!amount || amount <= 0) {
        return message.reply("You need to specify how many points to donate");
      }
      if (p1.points < amount) {
        return message.reply("You don't have that many points to donate");
      }

      p1.points -= amount;
      p2.points += amount;
      client.setScore.run(p1);
      client.setScore.run(p2);
      return message.reply(
        `${p1.username} has donated ${amount} points to ${p2.username}`
      );
    }

    if (command === "prestige") {
      if (score.points < prestigeRequirement) {
        return message.reply(
          `You need ${prestigeRequirement} points in order to Prestige!`
        );
      }

      score.points = 1;
      score.prestige += 1;
      client.setScore.run(score);
      return message.reply(
        `${score.username} prestiged to level ${score.prestige}`
      );
    }

    if (command === "duel") {
      let channelCheck = message.channelId;
      if (duelRunning[channelCheck] === undefined) {
        duelRunning[channelCheck] = false;
      }
      if (duelRunning[channelCheck] === true) {
        return message.channel.send("Another duel is happening!");
      }
      let amount = parseInt(args[1], 10);
      let pointsArray = ComparePoints();
      if (pointsArray === undefined) {
        return message.channel.send(
          "You must mention someone or give their ID!"
        );
      }
      let p1 = pointsArray[0];
      let p2 = pointsArray[1];
      if (!amount || amount <= 0) {
        return message.channel.send(
          "You need to specify how many points to bet"
        );
      }
      if (p1.points < amount) {
        return message.channel.send("You don't have that many points to bet");
      }
      if (p2.points < amount) {
        return message.channel.send(
          `That is more points than ${p2.username} has`
        );
      }
      let filter = (i) => i.user.id === p2.user;

      let accept = uuidv4();
      let decline = uuidv4();
      const row = new MessageActionRow()
        .addComponents(
          new MessageButton()
            .setCustomId(accept)
            .setLabel("Accept Duel")
            .setStyle("PRIMARY")
        )
        .addComponents(
          new MessageButton()
            .setCustomId(decline)
            .setLabel("Decline Duel")
            .setStyle("SECONDARY")
        );

      message.channel.send({
        content: `<@${p2.user}> ${p1.username} has challenged you to a duel for ${amount} points, do you accept?`,
        components: [row],
      });

      const collector = message.channel.createMessageComponentCollector({
        filter,
        componentType: "BUTTON",
        max: 1,
        maxComponents: 1,
        time: 30000,
      });

      collector.on("collect", async (message) => {
        if (duelRunning[channelCheck] === undefined) {
          duelRunning[channelCheck] = false;
        }
        if (duelRunning[channelCheck] === true) {
          return message.channel.send("Another duel is happening!");
        }
        if (message.user.id === p2.user && message.customId === accept) {
          message.channel.send("Then let the duel commence");
          collector.stop("user accepted");
          //duel function
          duelRunning[channelCheck] = true;
          BetterDuel(p1, p2, message, client, amount, duelCheck, channelCheck);
        } else if (
          message.user.id === p2.user &&
          message.customId === decline
        ) {
          message.channel.send("Challenge Declined");
          collector.stop("user declined");
          return;
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          message.channel.send("Duel terminated");
        }
      });
    }

    if (command === "leaderboard") {
      const top10 = sql
        .prepare(
          "SELECT * FROM scores WHERE guild = ? ORDER BY points DESC LIMIT 10;"
        )
        .all(message.guild.id);

      const embed = new MessageEmbed()
        .setTitle("Leader board")
        .setAuthor({
          name: client.user.username,
          iconUrl: client.user.avatarURL(),
        })
        .setDescription("Our top 10 points leaders!")
        .setColor(0x00ae86);

      for (const data of top10) {
        embed.addFields({
          name: data.username,
          value: `${data.points} points | Prestige ${data.prestige}`,
        });
      }
      return message.channel.send({ embeds: [embed] });
    }
  } else {
    return false;
  }
});

// Login to Discord with your client's token
client.login(process.env.BOT_TOKEN);
