// Require the necessary discord.js classes
const {
  Client,
  Intents,
  MessageEmbed,
  Interaction,
  MessageCollector,
  MessageActionRow,
  MessageButton,
  MessageComponentInteraction,
} = require("discord.js");
const { v4: uuidv4 } = require("uuid");
const discordClient = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MESSAGES,
    Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
    "GUILDS",
  ],
});
const paginationEmbed = require("discord.js-pagination");
const db = require("./database");
const { MongoClient } = require("mongodb");
const mongoClient = new MongoClient(process.env.MONGO_URI);

require("dotenv").config();
const { BetterDuel } = require("./duel");
let duelRunning = {};
let lastDrop = 0;
let loopRunning = false;
const prestigeRequirement = 5000;

discordClient.on("ready", () => {
  const Guilds = discordClient.guilds.cache.map((guild) => guild.id);

  console.log("ready!");
});

discordClient.on("messageCreate", async (message) => {
  if (message.author.bot) return;

  let score;

  await db
    .query("SELECT * FROM scores WHERE username = $1 AND guild = $2", [
      message.author.username,
      message.guild.id,
    ])
    .then((res) => (score = res.rows[0]));

  if (message.guild) {
    let points = 0;
    if (!score) {
      score = {
        id: `${message.guild.id}-${message.author.id}`,
        userid: message.author.id,
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

    message.awaitReactions({ filter, time: 20000 }).then(async (collected) => {
      collected.forEach(async (reaction) => {
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
      await db
        .query("SELECT * FROM scores WHERE username = $1 AND guild = $2", [
          message.author.username,
          message.guild.id,
        ])
        .then((res) => (score = res.rows[0]));

      score.points += points;

      await db.query(
        "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
        [
          score.id,
          score.userid,
          score.username,
          score.guild,
          score.points,
          score.prestige,
        ]
      );
    });

    await db.query(
      "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
      [
        score.id,
        score.userid,
        score.username,
        score.guild,
        score.points,
        score.prestige,
      ]
    );
  }
  if (message.content.indexOf(process.env.PREFIX) !== 0) return;

  const args = message.content
    .slice(process.env.PREFIX.length)
    .trim()
    .split(/ +/g);
  const command = args.shift().toLowerCase();

  if (
    message.channelId === "960715020898029588" ||
    message.channelId === "959230884475719760" ||
    message.channelId === "958465258178109530"
  ) {
    if (command === "points") {
      return message.reply(`You currently have ${score.points} points!`);
    }

    if (command === "give") {
      if (
        !message.member.roles.cache.some(
          (role) => role.name === "Mods" || role.name === "Jr Mod"
        )
      )
        return message.reply("Only mods can give points to other users");

      const user =
        message.mentions.users.first() ||
        discordClient.users.cache.get(args[0]);
      if (!user)
        return message.reply("You must mention someone or give their ID!");

      const pointsToAdd = parseInt(args[1], 10);
      if (!pointsToAdd)
        return message.reply("You didn't tell me how many points to give...");

      // Get their current points.
      let userScore;
      await db
        .query("SELECT * FROM scores WHERE userid = $1 AND guild = $2", [
          user.id,
          message.guild.id,
        ])
        .then((res) => (userScore = res.rows[0]));

      // It's possible to give points to a user we haven't seen, so we need to initiate defaults here too!
      if (!userScore) {
        userScore = {
          id: `${message.guild.id}-${user.id}`,
          userid: user.id,
          username: user.username,
          guild: message.guild.id,
          points: 1,
          prestige: 0,
        };
      }
      userScore.points += pointsToAdd;

      // And we save it!
      await db.query(
        "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
        [
          userScore.id,
          userScore.userid,
          userScore.username,
          userScore.guild,
          userScore.points,
          userScore.prestige,
        ]
      );

      return message.channel.send(
        `${user.tag} has received ${pointsToAdd} points and now stands at ${userScore.points} points.`
      );
    }

    if (command === "remove") {
      if (
        !message.member.roles.cache.some(
          (role) => role.name === "Mods" || role.name === "Jr Mod"
        )
      )
        return message.reply("Only mods can remove points of other users");

      const user =
        message.mentions.users.first() ||
        discordClient.users.cache.get(args[0]);
      if (!user)
        return message.reply("You must mention someone or give their ID!");

      const pointsToRemove = parseInt(args[1], 10);
      if (!pointsToRemove)
        return message.reply("You didn't tell me how many points to remove...");

      let userScore;
      await db
        .query("SELECT * FROM scores WHERE userid = $1 AND guild = $2", [
          user.id,
          message.guild.id,
        ])
        .then((res) => (userScore = res.rows[0]));

      if (!userScore) {
        userScore = {
          id: `${message.guild.id}-${user.id}`,
          userid: user.id,
          username: user.username,
          guild: message.guild.id,
          points: 1,
          prestige: 0,
        };
      }
      userScore.points -= pointsToRemove;
      if (userScore.points < 0) {
        userScore.points = 0;
      }

      await db.query(
        "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
        [
          userScore.id,
          userScore.userid,
          userScore.username,
          userScore.guild,
          userScore.points,
          userScore.prestige,
        ]
      );

      return message.channel.send(
        `${user.tag} has lost ${pointsToRemove} points and now stands at ${userScore.points} points.`
      );
    }

    if (command === "set") {
      if (
        !message.member.roles.cache.some(
          (role) => role.name === "Mods" || role.name === "Jr Mod"
        )
      )
        return message.reply("Only mods can set points of other users");

      const user =
        message.mentions.users.first() ||
        discordClient.users.cache.get(args[0]);
      if (!user)
        return message.reply("You must mention someone or give their ID!");

      const pointsToSet = parseInt(args[1], 10);
      if (!pointsToSet)
        return message.reply("You didn't tell me how many points to set...");

      // Get their current points.
      let userScore;
      await db
        .query("SELECT * FROM scores WHERE userid = $1 AND guild = $2", [
          user.id,
          message.guild.id,
        ])
        .then((res) => (userScore = res.rows[0]));

      // It's possible to give points to a user we haven't seen, so we need to initiate defaults here too!
      if (!userScore) {
        userScore = {
          id: `${message.guild.id}-${user.id}`,
          userid: user.id,
          username: user.username,
          guild: message.guild.id,
          points: 1,
          prestige: 0,
        };
      }
      userScore.points = pointsToSet;

      // And we save it!
      await db.query(
        "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
        [
          userScore.id,
          userScore.userid,
          userScore.username,
          userScore.guild,
          userScore.points,
          userScore.prestige,
        ]
      );

      return message.channel.send(
        `${user.tag} points were set to ${pointsToSet}.`
      );
    }

    if (command === "drop") {
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
          let userScore;
          await db
            .query("SELECT * FROM scores WHERE userid = $1 AND guild = $2", [
              message.user.id,
              message.guild.id,
            ])
            .then((res) => (userScore = res.rows[0]));

          if (!userScore) {
            userScore = {
              id: `${message.guild.id}-${message.user.id}`,
              userid: message.user.id,
              username: message.user.username,
              guild: message.guild.id,
              points: 1,
              prestige: 0,
            };
          }
          userScore.points += amount;

          await db.query(
            "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
            [
              userScore.id,
              userScore.userid,
              userScore.username,
              userScore.guild,
              userScore.points,
              userScore.prestige,
            ]
          );
          message.channel.send(
            `${message.user.username} claimed ${amount} points, they now have ${userScore.points} points`
          );
        }
      });

      collector.on("end", (collected) => {
        message.reply("The drop has ended");
      });
    }

    if (command === "fastdrop") {
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
      let filter = (i) =>
        !i.member.roles.cache.some(
          (role) => role.name === "Mods" || role.name === "Jr Mod"
        );
      let claim = uuidv4();

      let row2 = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId(claim)
          .setLabel("Claim Points")
          .setStyle("SUCCESS")
      );

      message.channel.send({
        content: `${score.username} has created a fastdrop of ${amount} points!`,
        max: 1,
        maxComponents: 1,
        components: [row2],
      });

      const collector = message.channel.createMessageComponentCollector({
        filter,
        componentType: "BUTTON",
        max: 1,
        time: 60000,
      });

      collector.on("collect", async (message) => {
        if (message.customId === claim) {
          let userScore;
          await db
            .query("SELECT * FROM scores WHERE userid = $1 AND guild = $2", [
              message.user.id,
              message.guild.id,
            ])
            .then((res) => (userScore = res.rows[0]));

          if (!userScore) {
            userScore = {
              id: `${message.guild.id}-${message.user.id}`,
              userid: message.user.id,
              username: message.user.username,
              guild: message.guild.id,
              points: 1,
              prestige: 0,
            };
          }
          userScore.points += amount;

          await db.query(
            "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
            [
              userScore.id,
              userScore.userid,
              userScore.username,
              userScore.guild,
              userScore.points,
              userScore.prestige,
            ]
          );
          message.channel.send(
            `${message.user.username} claimed ${amount} points, they now have ${userScore.points} points`
          );
        }
      });

      collector.on("end", (collected) => {
        message.reply("The fastdrop has ended");
      });
    }

    if (command === "check") {
      const user =
        message.mentions.users.first() ||
        discordClient.users.cache.get(args[0]);
      if (!user)
        return message.reply("You must mention someone or give their ID!");
      let userScore;
      await db
        .query("SELECT * FROM scores WHERE userid = $1 AND guild = $2", [
          user.id,
          message.guild.id,
        ])
        .then((res) => (userScore = res.rows[0]));

      if (!userScore) {
        userScore = {
          id: `${message.guild.id}-${user.id}`,
          userid: user.id,
          username: user.username,
          guild: message.guild.id,
          points: 1,
          prestige: 0,
        };
        await db.query(
          "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
          [
            userScore.id,
            userScore.userid,
            userScore.username,
            userScore.guild,
            userScore.points,
            userScore.prestige,
          ]
        );
      }
      return message.channel.send(`${user.tag} has ${userScore.points} points`);
    }

    if (command === "level") {
      const user =
        message.mentions.users.first() ||
        discordClient.users.cache.get(args[0]);
      if (!user)
        return message.reply("You must mention someone or give their ID!");
      let userScore;
      await db
        .query("SELECT * FROM scores WHERE userid = $1 AND guild = $2", [
          user.id,
          message.guild.id,
        ])
        .then((res) => (userScore = res.rows[0]));

      if (!userScore) {
        userScore = {
          id: `${message.guild.id}-${user.id}`,
          userid: user.id,
          username: user.username,
          guild: message.guild.id,
          points: 0,
          prestige: 0,
        };
        await db.query(
          "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
          [
            userScore.id,
            userScore.userid,
            userScore.username,
            userScore.guild,
            userScore.points,
            userScore.prestige,
          ]
        );
      }
      return message.channel.send(
        `${user.tag} is prestige level ${userScore.prestige}`
      );
    }

    async function ComparePoints() {
      const user =
        message.mentions.users.first() ||
        discordClient.users.cache.get(args[0]);
      if (!user) return undefined;
      // doesn't let you duel yourself
      if (user.id === message.author.id) {
        return undefined;
      }
      let authorScore;
      await db
        .query("SELECT * FROM scores WHERE userid = $1 AND guild = $2", [
          message.author.id,
          message.guild.id,
        ])
        .then((res) => (authorScore = res.rows[0]));

      let userScore;
      await db
        .query("SELECT * FROM scores WHERE userid = $1 AND guild = $2", [
          user.id,
          message.guild.id,
        ])
        .then((res) => (userScore = res.rows[0]));

      if (!userScore) {
        userScore = {
          id: `${message.guild.id}-${user.id}`,
          userid: user.id,
          username: user.username,
          guild: message.guild.id,
          points: 1,
          prestige: 0,
        };
      }

      await db.query(
        "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
        [
          userScore.id,
          userScore.userid,
          userScore.username,
          userScore.guild,
          userScore.points,
          userScore.prestige,
        ]
      );
      return [authorScore, userScore];
    }

    function duelCheck(channelCheck) {
      duelRunning[channelCheck] = false;
    }

    if (command === "compare") {
      let pointsArray = await ComparePoints();
      if (pointsArray === undefined) {
        return message.reply("You must mention someone.");
      }
      return message.channel.send(
        `${pointsArray[0].username} has ${pointsArray[0].points} points, while ${pointsArray[1].username} has ${pointsArray[1].points} points.`
      );
    }

    if (command === "donate") {
      let betting = await getBetters(mongoClient, message);
      if (!betting)
        return message.channel.send(
          "You cannot use this while betting in the mickey games!"
        );

      let channelCheck = message.channelId;
      if (
        duelRunning[channelCheck] !== false &&
        duelRunning[channelCheck] !== undefined
      ) {
        if (
          message.author.username === duelRunning[channelCheck].p1 ||
          message.author.username === duelRunning[channelCheck].p2
        ) {
          return message.reply("You cannot donate while in a duel!");
        }
      }

      let pointsArray = await ComparePoints();
      if (pointsArray === undefined) {
        return message.reply("You must mention someone or give their ID!");
      }
      let p1 = pointsArray[0];
      let p2 = pointsArray[1];

      let amount = parseInt(args[1], 10);

      if (args[1] === "all" || args[1] === "All" || args[1] === "ALL") {
        amount = p1.points;
      } else {
        amount = parseInt(args[1], 10);
      }
      if (!amount || amount <= 0) {
        return message.reply(
          'You need to specify how many points to bet, or use "all" to donate everything'
        );
      }
      if (p1.points < amount) {
        return message.reply("You don't have that many points to donate");
      }

      p1.points -= amount;
      p2.points += amount;

      await db.query(
        "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
        [p1.id, p1.userid, p1.username, p1.guild, p1.points, p1.prestige]
      );
      await db.query(
        "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
        [p2.id, p2.userid, p2.username, p2.guild, p2.points, p2.prestige]
      );

      return message.reply(
        `${p1.username} has donated ${amount} points to ${p2.username}`
      );
    }

    if (command === "prestige") {
      let betting = await getBetters(mongoClient, message);
      if (!betting)
        return message.channel.send(
          "You cannot use this while betting in the mickey games!"
        );
      if (score.points < prestigeRequirement) {
        return message.reply(
          `You need ${prestigeRequirement} points in order to Prestige!`
        );
      }

      score.points = 1;
      score.prestige += 1;
      await db.query(
        "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
        [
          score.id,
          score.userid,
          score.username,
          score.guild,
          score.points,
          score.prestige,
        ]
      );
      return message.reply(
        `${score.username} prestiged to level ${score.prestige}`
      );
    }

    if (command === "setprestige") {
      if (
        !message.member.roles.cache.some(
          (role) => role.name === "Mods" || role.name === "Jr Mod"
        )
      )
        return message.reply("Only mods can set prestige of other users");

      const user =
        message.mentions.users.first() ||
        discordClient.users.cache.get(args[0]);
      if (!user)
        return message.reply("You must mention someone or give their ID!");

      const prestigeToSet = parseInt(args[1], 10);
      if (!prestigeToSet)
        return message.reply("You didn't tell me what prestige to set...");

      // Get their current points.
      let userScore;
      await db
        .query("SELECT * FROM scores WHERE userid = $1 AND guild = $2", [
          user.id,
          message.guild.id,
        ])
        .then((res) => (userScore = res.rows[0]));

      // It's possible to give points to a user we haven't seen, so we need to initiate defaults here too!
      if (!userScore) {
        userScore = {
          id: `${message.guild.id}-${user.id}`,
          userid: user.id,
          username: user.username,
          guild: message.guild.id,
          points: 1,
          prestige: 0,
        };
      }
      userScore.points = 1;
      userScore.prestige = prestigeToSet;

      // And we save it!
      await db.query(
        "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
        [
          userScore.id,
          userScore.userid,
          userScore.username,
          userScore.guild,
          userScore.points,
          userScore.prestige,
        ]
      );

      return message.channel.send(
        `${user.tag} prestige were set to ${prestigeToSet}.`
      );
    }

    if (command === "startdrop") {
      if (message.channelId === "960715020898029588") {
        // if (
        //   !message.member.roles.cache.some(
        //     (role) => role.name === "Mods" || role.name === "Jr Mod"
        //   )
        // )
        //   return message.reply("Only mods can activate drops");
        if (loopRunning) {
          return message.channel.send("Drops are currently active!");
        }
        message.channel.send("Drops are currently active!");
        loopRunning = true;
        function dropStart() {
          let clickedDrop = [];
          let amount = 0;
          let luckyChance = randomInt(100) + 1;
          if (luckyChance <= 3) {
            amount = 100;
          } else {
            amount = Math.floor(Math.random() * (25 - 10) + 10);
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
            content: `<@&980511400206147655> Scambot has created a drop of ${amount} points!`,
            maxComponents: 1,
            components: [row2],
          });

          const collector = message.channel.createMessageComponentCollector({
            filter,
            componentType: "BUTTON",
            time: 1800000,
          });

          collector.on("collect", async (message) => {
            if (message.customId === claim) {
              clickedDrop.push(message.user.id);
              let userScore;
              await db
                .query(
                  "SELECT * FROM scores WHERE userid = $1 AND guild = $2",
                  [message.user.id, message.guild.id]
                )
                .then((res) => (userScore = res.rows[0]));

              if (!userScore) {
                userScore = {
                  id: `${message.guild.id}-${message.user.id}`,
                  userid: message.user.id,
                  username: message.user.username,
                  guild: message.guild.id,
                  points: 1,
                  prestige: 0,
                };
              }
              userScore.points += amount;

              await db.query(
                "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
                [
                  userScore.id,
                  userScore.userid,
                  userScore.username,
                  userScore.guild,
                  userScore.points,
                  userScore.prestige,
                ]
              );
              message.channel.send(
                `${message.user.username} claimed ${amount} points, they now have ${userScore.points} points`
              );
            }
          });

          collector.on("end", (collected) => {
            message.channel.send("The previous Scamdrop has ended");
          });
        }

        dropStart();

        function loop() {
          let currentDate = new Date();
          let timestamp = currentDate.getTime();
          let rand =
            Math.round(Math.random() * (21600000 - 10800000)) + 10800000;
          // let rand = Math.round(Math.random() * (120000 - 60000)) + 60000;
          lastDrop = timestamp + rand;
          let timeUntil = convertMsToHM(rand);
          message.channel.send(
            `${timeUntil[0]} hours and ${timeUntil[1]} minutes until the next drop`
          );
          setTimeout(function () {
            dropStart();
            loop();
          }, rand);
        }

        loop();
      }
    }

    if (command === "checkdrop") {
      let currentDate = new Date();
      let timestamp = currentDate.getTime();
      let timeRemaining = lastDrop - timestamp;
      let timeUntil = convertMsToHM(timeRemaining);
      message.channel.send(
        `${timeUntil[0]} hours and ${timeUntil[1]} minutes until the next drop`
      );
    }

    if (command === "duel") {
      let betting = await getBetters(mongoClient, message);
      if (!betting)
        return message.channel.send(
          "You cannot use this while betting in the mickey games!"
        );
      let channelCheck = message.channelId;
      if (duelRunning[channelCheck] === undefined) {
        duelRunning[channelCheck] = false;
      }
      if (duelRunning[channelCheck].running === true) {
        return message.channel.send("Another duel is happening!");
      }
      let pointsArray = await ComparePoints();
      if (pointsArray === undefined) {
        return message.channel.send(
          "You must mention someone or give their ID!"
        );
      }
      let p1 = pointsArray[0];
      let p2 = pointsArray[1];

      let amount;

      if (args[1] === "all" || args[1] === "All" || args[1] === "ALL") {
        amount = p1.points;
      } else {
        amount = parseInt(args[1], 10);
      }
      if (!amount || amount <= 0) {
        return message.channel.send(
          'You need to specify how many points to bet, or use "all" to bet everything'
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
      let filter = (i) => i.user.id === p2.userid;

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
        content: `<@${p2.userid}> ${p1.username} has challenged you to a duel for ${amount} points, do you accept?`,
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
        if (duelRunning[channelCheck].running === true) {
          return message.channel.send("Another duel is happening!");
        }
        if (message.user.id === p2.userid && message.customId === accept) {
          message.channel.send("Then let the duel commence");
          collector.stop("user accepted");
          duelRunning[channelCheck] = {
            running: true,
            p1: p1.username,
            p2: p2.username,
          };
          await BetterDuel(
            p1,
            p2,
            message,
            db,
            amount,
            duelCheck,
            channelCheck
          );
        } else if (
          message.user.id === p2.userid &&
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

    if (command === "anyduel") {
      let betting = await getBetters(mongoClient, message);
      if (!betting)
        return message.channel.send(
          "You cannot use this while betting in the mickey games!"
        );
      let channelCheck = message.channelId;
      if (duelRunning[channelCheck] === undefined) {
        duelRunning[channelCheck] = false;
      }
      if (duelRunning[channelCheck].running === true) {
        return message.channel.send("Another duel is happening!");
      }

      let p1;
      await db
        .query("SELECT * FROM scores WHERE userid = $1 AND guild = $2", [
          message.author.id,
          message.guild.id,
        ])
        .then((res) => (p1 = res.rows[0]));

      let amount;
      if (args[0].toLocaleLowerCase() === "all") {
        amount = p1.points;
      } else {
        amount = parseInt(args[0], 10);
      }

      if (!amount || amount <= 0) {
        return message.channel.send(
          'You need to specify how many points to bet, or use "all" to bet everything'
        );
      }

      if (p1.points < amount) {
        return message.channel.send("You don't have that many points to bet");
      }

      let filter = async (i) => {
        let userScore;
        await db
          .query("SELECT * FROM scores WHERE userid = $1 AND guild = $2", [
            i.user.id,
            message.guild.id,
          ])
          .then((res) => (userScore = res.rows[0]));
        if (userScore.points >= amount && userScore.username !== p1.username) {
          return true;
        }
      };

      let accept = uuidv4();
      const row = new MessageActionRow().addComponents(
        new MessageButton()
          .setCustomId(accept)
          .setLabel("Accept Duel")
          .setStyle("PRIMARY")
      );

      message.channel.send({
        content: `${p1.username} has requested a duel for ${amount} points, do you accept?`,
        max: 1,
        maxComponents: 1,
        components: [row],
      });

      const collector = message.channel.createMessageComponentCollector({
        filter,
        componentType: "BUTTON",
        max: 1,
        time: 60000,
      });

      collector.on("collect", async (message) => {
        if (duelRunning[channelCheck] === undefined) {
          duelRunning[channelCheck] = false;
        }
        if (duelRunning[channelCheck] === true) {
          return message.channel.send("Another duel is happening!");
        }
        let p2;
        await db
          .query("SELECT * FROM scores WHERE userid = $1 AND guild = $2", [
            message.user.id,
            message.guild.id,
          ])
          .then((res) => (p2 = res.rows[0]));
        if (p2.points < amount) {
          return message.channel.send("not enough points");
        }

        if (message.customId === accept) {
          message.channel.send("Then let the duel commence");
          collector.stop("user accepted");
          duelRunning[channelCheck] = {
            running: true,
            p1: p1.username,
            p2: p2.username,
          };
          await BetterDuel(
            p1,
            p2,
            message,
            db,
            amount,
            duelCheck,
            channelCheck
          );
        }
      });

      collector.on("end", (collected) => {
        if (collected.size === 0) {
          message.channel.send("Duel terminated");
        }
      });
    }
    const backId = "back";
    const forwardId = "forward";
    const backButton = new MessageButton({
      style: "SECONDARY",
      label: "Back",
      emoji: "⬅️",
      customId: backId,
    });
    const forwardButton = new MessageButton({
      style: "SECONDARY",
      label: "Forward",
      emoji: "➡️",
      customId: forwardId,
    });

    if (command === "leaderboard") {
      let result;
      await db
        .query("SELECT * FROM scores WHERE guild = $1 ORDER BY points DESC", [
          message.guild.id,
        ])
        .then((res) => (result = res.rows));
      const generateEmbed = async (start) => {
        const current = result.slice(start, start + 10);

        // You can of course customise this embed however you want
        return new MessageEmbed({
          title: `Showing players ${start + 1}-${
            start + current.length
          } out of ${result.length}`,
          fields: await Promise.all(
            current.map(async (result) => ({
              name: result.username,
              value: `${result.points} points | Prestige ${result.prestige}`,
            }))
          ),
        });
      };

      // Send the embed with the first 10 guilds
      const canFitOnOnePage = result.length <= 10;
      const embedMessage = await message.channel.send({
        embeds: [await generateEmbed(0)],
        components: canFitOnOnePage
          ? []
          : [new MessageActionRow({ components: [forwardButton] })],
      });
      // Exit if there is only one page of guilds (no need for all of this)
      if (canFitOnOnePage) return;

      // Collect button interactions (when a user clicks a button),
      // but only when the button as clicked by the original message author
      const collector = embedMessage.createMessageComponentCollector({
        filter: ({ user }) => user.id === message.author.id,
      });

      let currentIndex = 0;
      collector.on("collect", async (interaction) => {
        // Increase/decrease index
        interaction.customId === backId
          ? (currentIndex -= 10)
          : (currentIndex += 10);
        // Respond to interaction by updating message with new embed
        await interaction.update({
          embeds: [await generateEmbed(currentIndex)],
          components: [
            new MessageActionRow({
              components: [
                // back button if it isn't the start
                ...(currentIndex ? [backButton] : []),
                // forward button if it isn't the end
                ...(currentIndex + 10 < result.length ? [forwardButton] : []),
              ],
            }),
          ],
        });
      });
    }

    if (command === "prestigeboard") {
      let result;
      await db
        .query("SELECT * FROM scores WHERE guild = $1 ORDER BY prestige DESC", [
          message.guild.id,
        ])
        .then((res) => (result = res.rows));
      const generateEmbed = async (start) => {
        const current = result.slice(start, start + 10);

        // You can of course customise this embed however you want
        return new MessageEmbed({
          title: `Showing players ${start + 1}-${
            start + current.length
          } out of ${result.length}`,
          fields: await Promise.all(
            current.map(async (result) => ({
              name: result.username,
              value: `${result.points} points | Prestige ${result.prestige}`,
            }))
          ),
        });
      };

      // Send the embed with the first 10 guilds
      const canFitOnOnePage = result.length <= 10;
      const embedMessage = await message.channel.send({
        embeds: [await generateEmbed(0)],
        components: canFitOnOnePage
          ? []
          : [new MessageActionRow({ components: [forwardButton] })],
      });
      // Exit if there is only one page of guilds (no need for all of this)
      if (canFitOnOnePage) return;

      // Collect button interactions (when a user clicks a button),
      // but only when the button as clicked by the original message author
      const collector = embedMessage.createMessageComponentCollector({
        filter: ({ user }) => user.id === message.author.id,
      });

      let currentIndex = 0;
      collector.on("collect", async (interaction) => {
        // Increase/decrease index
        interaction.customId === backId
          ? (currentIndex -= 10)
          : (currentIndex += 10);
        // Respond to interaction by updating message with new embed
        await interaction.update({
          embeds: [await generateEmbed(currentIndex)],
          components: [
            new MessageActionRow({
              components: [
                // back button if it isn't the start
                ...(currentIndex ? [backButton] : []),
                // forward button if it isn't the end
                ...(currentIndex + 10 < result.length ? [forwardButton] : []),
              ],
            }),
          ],
        });
      });
    }
    function padTo2Digits(num) {
      return num.toString().padStart(2, "0");
    }

    function convertMsToHM(milliseconds) {
      let seconds = Math.floor(milliseconds / 1000);
      let minutes = Math.floor(seconds / 60);
      let hours = Math.floor(minutes / 60);

      seconds = seconds % 60;
      // if seconds are greater than 30, round minutes up (optional)
      minutes = seconds >= 30 ? minutes + 1 : minutes;

      minutes = minutes % 60;

      // If you don't want to roll hours over, e.g. 24 to 00
      // comment (or remove) the line below
      // commenting next line gets you `24:00:00` instead of `00:00:00`
      // or `36:15:31` instead of `12:15:31`, etc.
      hours = hours % 24;

      return [padTo2Digits(hours), padTo2Digits(minutes)];
    }

    function randomInt(max) {
      return Math.floor(Math.random() * max);
    }

    async function getBetters(mongoClient, message) {
      await mongoClient.connect();
      const result = await mongoClient
        .db("hunger-games")
        .collection("active-tributes")
        .findOne({
          guild: message.guild.id,
        });

      // console.log(result);
      if (result.bets.length === 0) return true;
      console.log(result.bet);

      await result.bets.map((user) => {
        console.log(user);
        if (message.author.username === user.username) {
          console.log("yes");
          return false;
        } else {
          console.log("no");
          return true;
        }
      });
    }
  } else {
    return false;
  }
});

// Login to Discord with your discordClient's token
discordClient.login(process.env.BOT_TOKEN);
