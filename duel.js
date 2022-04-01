const cli = require("nodemon/lib/cli");
const duelItems = require("./duel.json");

function randomInt(max) {
  return Math.floor(Math.random() * max);
}

function calculateDamage(min, max, crit) {
  min = Math.ceil(min);
  max = Math.floor(max);
  let dmg = Math.floor(Math.random() * (max - min) + min);
  let criticalHit = false;
  let critical = randomInt(100);
  if (critical <= crit) {
    dmg = dmg * 2;
    criticalHit = true;
  }
  return { dmg: dmg, criticalHit: criticalHit };
}

function getRandomItem(max) {
  let index = randomInt(max);
  return duelItems.weapons[index];
}

function getWeapon(Player1, Player2, message) {
  if (Player1.weapon === "") {
    let item = getRandomItem(duelItems.weapons.length);
    Player1.weapon = item;
    message.channel.send(
      `**${Player1.name}** picked up a ${Player1.weapon.name}`
    );
  }
  if (Player2.weapon === "") {
    item = getRandomItem(duelItems.weapons.length);
    Player2.weapon = item;
    message.channel.send(
      `**${Player2.name}** picked up a ${Player2.weapon.name}`
    );
  }

  if (Player1.weapon.name === "Fists") {
    let roll = randomInt(100);
    if (roll < 40) {
      item = getRandomItem(duelItems.weapons.length);
      Player1.weapon = item;
      message.channel.send(
        `**${Player1.name}** picked up a ${Player1.weapon.name}`
      );
    }
    return;
  }
  if (Player2.weapon.name === "Fists") {
    let roll = randomInt(100);
    if (roll < 40) {
      item = getRandomItem(duelItems.weapons.length);
      Player2.weapon = item;
      message.channel.send(
        `**${Player2.name}** picked up a ${Player2.weapon.name}`
      );
    }
    return;
  }
}

function Turn(Player1, Player2, message, client, p1, p2, amount) {
  if (Player1.hp <= 0) {
    message.channel.send(
      `**${Player2.name}** wins! **${Player1.name}** handed over ${amount} points`
    );
    gameOver(Player2, message, client, p1, p2, amount);
    return;
  }
  if (Player2.hp <= 0) {
    message.channel.send(
      `**${Player1.name}** wins! **${Player2.name}** handed over ${amount} points`
    );
    gameOver(Player1, message, client, p1, p2, amount);
    return;
  }
  const result = Math.random() < 0.5;
  if (result) {
    Battle(Player1, Player2, message);
  } else {
    Battle(Player2, Player1, message);
  }
  Round(Player1, Player2, message, client, p1, p2, amount);
}

function Battle(attacker, defender, message) {
  let hit = randomInt(100);
  if (hit <= attacker.weapon.accuracy) {
    let strike = calculateDamage(
      attacker.weapon.minDamage,
      attacker.weapon.maxDamage,
      attacker.weapon.critChance
    );
    if (strike.criticalHit === true) {
      message.channel.send(
        `Crtical hit! **${attacker.name}**(${attacker.hp}HP) attacks **${defender.name}**(${defender.hp}HP) for **${strike.dmg}** damage!`
      );
    } else {
      message.channel.send(
        `**${attacker.name}**(${attacker.hp}HP) attacks **${defender.name}**(${defender.hp}HP) for ${strike.dmg} damage!`
      );
    }
    defender.hp -= strike.dmg;
  } else {
    message.channel.send(`**${attacker.name}**(${attacker.hp}HP) missed!`);
  }

  if (defender.hp < 0) {
    return;
  }
  if (attacker.weapon.name === "Fists") {
    return;
  }
  let breakWeapon = randomInt(100);
  if (breakWeapon <= 15) {
    message.channel.send(
      `**${attacker.name}'s** ${attacker.weapon.name} broke!`
    );
    attacker.weapon = {
      name: "Fists",
      type: "melee",
      maxDamage: 6,
      minDamage: 4,
      critChance: 20,
      accuracy: 90,
    };
  }
}

function Round(Player1, Player2, message, client, p1, p2, amount) {
  getWeapon(Player1, Player2, message);
  setTimeout(() => {
    Turn(Player1, Player2, message, client, p1, p2, amount);
  }, 2500);
}

function gameOver(winner, message, client, p1, p2, amount) {
  let newP1 = client.getScore.get(p1.user, p1.guild);
  let newP2 = client.getScore.get(p2.user, p1.guild);
  switch (winner.name) {
    case p1.username:
      newP1.points += amount;
      newP2.points -= amount;
      if (newP2.points < 0) {
        newP2.points = 0;
      }
      client.setScore.run(newP1);
      client.setScore.run(newP2);
      break;
    case p2.username:
      newP2.points += amount;
      newP1.points -= amount;
      if (newP2.points < 0) {
        newP2.points = 0;
      }
      client.setScore.run(newP1);
      client.setScore.run(newP2);
      break;
    default:
      break;
  }
}

function getHP(amount) {
  if (amount <= 50) {
    return 1;
  } else if (amount > 50 && amount <= 100) {
    return 10;
  } else {
    return 20;
  }
}

function BetterDuel(p1, p2, message, client, amount) {
  // let hp = getHP(amount);
  let hp = 20;
  let Player1 = {
    name: p1.username,
    hp: hp,
    weapon: "",
  };
  let Player2 = {
    name: p2.username,
    hp: hp,
    weapon: "",
  };
  setTimeout(() => {
    Round(Player1, Player2, message, client, p1, p2, amount);
  }, 1000);
}

module.exports = { BetterDuel };
