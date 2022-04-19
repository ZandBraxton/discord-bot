const duelItems = require("./duel.json");

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function calculateDamage(min, max, crit) {
  min = Math.ceil(min);
  max = Math.floor(max);
  let dmg = Math.floor(Math.random() * (max - min) + min);
  if (crit === null) {
    return dmg;
  }
  let criticalHit = false;
  let critical = randomInt(100) + 1;
  if (critical <= crit) {
    dmg = dmg * 2;
    criticalHit = true;
  }
  return { dmg: dmg, criticalHit: criticalHit };
}

async function attack(attacker, defender, message) {
  let strike = calculateDamage(
    attacker.weapon.minDamage,
    attacker.weapon.maxDamage,
    attacker.weapon.critChance
  );
  if (defender.hp - strike.dmg <= 0) {
    let surviveChance = randomInt(100) + 1;
    if (surviveChance === 1) {
      message.channel.send(
        `**${attacker.name}**(${attacker.hp}HP) attacks, but **${defender.name}**(${defender.hp}HP) miraculously clings to life!`
      );
      defender.hp = 1;
      return;
    }
  }
  if (strike.criticalHit === true) {
    message.channel.send(
      `Critical hit! **${attacker.name}**(${attacker.hp}HP) attacks **${defender.name}**(${defender.hp}HP) for **${strike.dmg}** damage!`
    );
  } else {
    message.channel.send(
      `**${attacker.name}**(${attacker.hp}HP) attacks **${defender.name}**(${defender.hp}HP) for ${strike.dmg} damage!`
    );
  }
  defender.hp -= strike.dmg;
  defender.evadeChance += 2;
}

function getRandomItem(max, rarity) {
  let index = randomInt(max);
  return duelItems.weapons[rarity][index];
}

function getRandomEvent(max) {
  let index = randomInt(max);
  return duelItems.events[index];
}

function getWeapon(Player, message) {
  if (Player.weapon === "") {
    let rarity = randomInt(100) + 1;
    if (rarity <= 50) {
      rarity = "Common";
    } else if (rarity > 51 && rarity <= 80) {
      rarity = "Rare";
    } else {
      rarity = "Legendary";
    }
    let item = getRandomItem(duelItems.weapons[rarity].length, rarity);
    Player.weapon = item;
    message.channel.send(
      `**${Player.name}** picked up a ${Player.weapon.name} **[${rarity}]**`
    );
  }

  if (Player.weapon.name === "Fists") {
    let roll = randomInt(100) + 1;
    if (roll < 40) {
      let rarity = randomInt(100) + 1;
      if (rarity <= 50) {
        rarity = "Common";
      } else if (rarity > 51 && rarity <= 80) {
        rarity = "Rare";
      } else {
        rarity = "Legendary";
      }
      item = getRandomItem(duelItems.weapons[rarity].length, rarity);
      Player.weapon = item;
      message.channel.send(
        `**${Player.name}** picked up a ${Player.weapon.name} **[${rarity}]**`
      );
    }
    return;
  }
}

async function Turn(Player1, Player2, message, db, p1, p2, amount, duelCheck) {
  if (Player1.hp <= 0) {
    message.channel.send(
      `**${Player2.name}** wins! **${Player1.name}** handed over ${amount} points`
    );
    await gameOver(Player2, message, db, p1, p2, amount);
    duelCheck(message.channelId);
    return;
  }
  if (Player2.hp <= 0) {
    message.channel.send(
      `**${Player1.name}** wins! **${Player2.name}** handed over ${amount} points`
    );
    await gameOver(Player1, message, db, p1, p2, amount);
    duelCheck(message.channelId);
    return;
  }
  let eventChance = randomInt(100) + 1;
  if (eventChance < 5) {
    randomEvent(Player1, Player2, message, db, p1, p2, amount, duelCheck);
    return;
  } else {
    if (Player1.attacking === true) {
      let result = randomInt(100) + 1;
      if (result <= 75) {
        Battle(Player2, Player1, message);
        Player2.attacking = true;
        Player1.attacking = false;
      } else {
        Battle(Player1, Player2, message);
      }
    } else {
      let result = randomInt(100) + 1;
      if (result <= 75) {
        Battle(Player1, Player2, message);
        Player1.attacking = true;
        Player2.attacking = false;
      } else {
        Battle(Player2, Player1, message);
      }
    }
  }

  Round(Player1, Player2, message, db, p1, p2, amount, duelCheck);
}

async function Battle(attacker, defender, message) {
  let hit = randomInt(100) + 1;
  if (hit <= attacker.weapon.accuracy) {
    if (hit <= defender.evadeChance) {
      message.channel.send(
        ` **${attacker.name}**(${attacker.hp}HP) attacks! HOWEVER!, **${defender.name}**(${defender.hp}HP) evades it!`
      );
    } else if (
      defender.weapon.special !== null &&
      defender.weapon.special["type"] === "block"
    ) {
      defender.usedShield = defender.weapon.special["value"];
      if (hit <= defender.usedShield) {
        message.channel.send(
          ` **${attacker.name}**(${attacker.hp}HP) attacks! HOWEVER!, **${defender.name}**(${defender.hp}HP) ${defender.weapon.special["message"]}!`
        );
        defender.usedShield -= 5;
      } else {
        await attack(attacker, defender, message);
      }
    } else {
      await attack(attacker, defender, message);
    }
  } else {
    message.channel.send(`**${attacker.name}**(${attacker.hp}HP) missed!`);
  }

  if (defender.hp < 0) {
    return;
  }
  if (attacker.weapon.special !== null) {
    if (
      attacker.weapon.special["trigger-name"] === attacker.name &&
      attacker.usedSpecial === false
    ) {
      if (attacker.weapon.special["type"] === "damage") {
        message.channel.send(
          `**${attacker.name}**(${attacker.hp}HP) activated their weapons ability!`
        );
        message.channel.send(`${attacker.weapon.special["message"]}`);
        message.channel.send(
          `**${defender.name}**(${defender.hp}HP) ${attacker.weapon.special["message-effect"]}`
        );
        attacker.usedSpecial = true;
        defender.hp -= attacker.weapon.special["value"];
      } else if (attacker.weapon.special["type"] === "heal") {
        message.channel.send(
          `**${attacker.name}**(${attacker.hp}HP) activated their weapons ability!`
        );
        message.channel.send(`${attacker.weapon.special["message"]}`);
        message.channel.send(
          `**${attacker.name}**(${attacker.hp}HP) ${attacker.weapon.special["message-effect"]}`
        );
        attacker.usedSpecial = true;
        attacker.hp += attacker.weapon.special["value"];
      }
    }
  } else if (defender.weapon.special !== null) {
    if (
      defender.weapon.special["trigger-name"] === defender.name &&
      defender.usedSpecial === false
    ) {
      if (defender.weapon.special["type"] === "heal") {
        message.channel.send(
          `**${defender.name}**(${defender.hp}HP) activated their weapons ability!`
        );
        message.channel.send(`${defender.weapon.special["message"]}`);
        message.channel.send(
          `**${defender.name}**(${defender.hp}HP) ${defender.weapon.special["message-effect"]}`
        );
        defender.usedSpecial = true;
        defender.hp += defender.weapon.special["value"];
      }
    }
  }
  if (attacker.weapon.name === "Fists") {
    return;
  }
  let breakWeapon = randomInt(100) + 1;
  if (breakWeapon <= attacker.weapon.breakChance) {
    message.channel.send(
      `**${attacker.name}'s** ${attacker.weapon.name} broke!`
    );
    attacker.weapon = {
      name: "Fists",
      type: "melee",
      minDamage: 3,
      maxDamage: 5,
      critChance: 10,
      accuracy: 85,
      breakChance: 0,
      special: null,
    };
  }
}

async function Round(Player1, Player2, message, db, p1, p2, amount, duelCheck) {
  if (Player1.hp >= 0 && Player2.hp >= 0) {
    await getWeapon(Player1, message);
    await getWeapon(Player2, message);
  }
  setTimeout(() => {
    Turn(Player1, Player2, message, db, p1, p2, amount, duelCheck);
  }, 2500);
}

async function gameOver(winner, message, db, p1, p2, amount) {
  await db
    .query("SELECT * FROM scores WHERE userid = $1 AND guild = $2", [
      p1.userid,
      p1.guild,
    ])
    .then((res) => (newP1 = res.rows[0]));

  await db
    .query("SELECT * FROM scores WHERE userid = $1 AND guild = $2", [
      p2.userid,
      p2.guild,
    ])
    .then((res) => (newP2 = res.rows[0]));

  switch (winner.name) {
    case p1.username:
      newP1.points += amount;
      newP2.points -= amount;
      if (newP2.points < 0) {
        newP2.points = 0;
      }
      await db.query(
        "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
        [
          newP1.id,
          newP1.userid,
          newP1.username,
          newP1.guild,
          newP1.points,
          newP1.prestige,
        ]
      );

      await db.query(
        "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
        [
          newP2.id,
          newP2.userid,
          newP2.username,
          newP2.guild,
          newP2.points,
          newP2.prestige,
        ]
      );
      break;
    case p2.username:
      newP2.points += amount;
      newP1.points -= amount;
      if (newP2.points < 0) {
        newP2.points = 0;
      }
      await db.query(
        "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
        [
          newP1.id,
          newP1.userid,
          newP1.username,
          newP1.guild,
          newP1.points,
          newP1.prestige,
        ]
      );

      await db.query(
        "INSERT INTO scores (id, userid, username, guild, points, prestige) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO UPDATE SET (userid, username, guild, points, prestige) = (EXCLUDED.userid, EXCLUDED.username, EXCLUDED.guild, EXCLUDED.points, EXCLUDED.prestige)",
        [
          newP2.id,
          newP2.userid,
          newP2.username,
          newP2.guild,
          newP2.points,
          newP2.prestige,
        ]
      );
      break;
    default:
      break;
  }
}

function getHP(amount) {
  if (amount <= 49) {
    return 15;
  } else if (amount >= 50 && amount <= 299) {
    return 25;
  } else if (amount >= 300 && amount <= 499) {
    return 30;
  } else if (amount >= 500 && amount <= 999) {
    return 35;
  } else {
    return 45;
  }
}

function randomEvent(Player1, Player2, message, db, p1, p2, amount, duelCheck) {
  let event = getRandomEvent(duelItems.events.length);
  message.channel.send(`**!!! EVENT !!!**`);
  setTimeout(() => {
    message.channel.send(`${event.message}`);
    message.channel.send(`${event.attack}`);
    setTimeout(() => {
      getEventResult(event, Player1, Player2, message);
      Round(Player1, Player2, message, db, p1, p2, amount, duelCheck);
    }, 2000);
  }, 1000);
}

function getEventResult(event, attacker, defender, message) {
  //decide if miss
  let hit = randomInt(100) + 1;
  if (hit <= event.accuracy) {
    let strike = calculateDamage(event.minDamage, event.maxDamage, null);
    let result = Math.random() < 0.5;
    if (event.type === "heal") {
      if (result) {
        message.channel.send(`${attacker.name} was healed for ${strike} hp!`);
        attacker.hp += strike;
      } else {
        message.channel.send(`${defender.name} was healed for ${strike} hp!`);
        defender.hp += strike;
      }
    } else {
      if (result) {
        message.channel.send(`${attacker.name} takes ${strike} damage!`);
        attacker.hp -= strike;
      } else {
        message.channel.send(`${defender.name} takes ${strike} damage!`);
        defender.hp -= strike;
      }
    }
  } else {
    message.channel.send(`${event.miss}`);
  }
}

async function BetterDuel(p1, p2, message, db, amount, duelCheck) {
  let hp = getHP(amount);
  let Player1 = {
    name: p1.username,
    hp: hp,
    weapon: "",
    attacking: false,
    evadeChance: 2,
    usedSpecial: false,
    usedShield: 0,
  };
  let Player2 = {
    name: p2.username,
    hp: hp,
    weapon: "",
    attacking: false,
    evadeChance: 2,
    usedSpecial: false,
    usedShield: 0,
  };
  let result = Math.random() < 0.5;
  if (result) {
    Player1.attacking = true;
  } else {
    Player2.attacking = true;
  }
  setTimeout(() => {
    Round(Player1, Player2, message, db, p1, p2, amount, duelCheck);
  }, 1000);
}

module.exports = { BetterDuel };
