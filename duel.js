const duelItems = require("./duel.json");
console.log(duelItems.weapons.length);

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
  console.log("weapon check");
}

function Turn(Player1, Player2, message, client, p1, p2, amount) {
  console.log(Player1.hp, Player2.hp);
  if (Player1.hp <= 0) {
    message.channel.send(`**${Player2.name}** wins!`);
    console.log(Player1.name);
    console.log(Player2.name);
    console.log(p1.username);
    console.log(p2.username);
    switch (Player2.name) {
      case p1.username:
        p1.points += amount;
        p2.points -= amount;
        if (p2.points < 0) {
          p2.points = 0;
        }
        console.log(p1);
        console.log(p2);
        client.setScore.run(p1);
        client.setScore.run(p2);
        break;
      case p2.username:
        p2.points += amount;
        p1.points -= amount;
        if (p2.points < 0) {
          p2.points = 0;
        }
        console.log(p1);
        console.log(p2);
        client.setScore.run(p1);
        client.setScore.run(p2);
        break;
      default:
        break;
    }
    return;
  }
  if (Player2.hp <= 0) {
    message.channel.send(`**${Player1.name}** wins!`);
    console.log(Player1.name);
    console.log(Player2.name);
    console.log(p1.name);
    console.log(p2.name);
    switch (Player1.name) {
      case p1.username:
        p1.points += amount;
        p2.points -= amount;
        if (p2.points < 0) {
          p2.points = 0;
        }
        console.log(p1);
        console.log(p2);
        client.setScore.run(p1);
        client.setScore.run(p2);
        break;
      case p2.username:
        p2.points += amount;
        p1.points -= amount;
        if (p2.points < 0) {
          p2.points = 0;
        }
        console.log(p1);
        console.log(p2);
        client.setScore.run(p1);
        client.setScore.run(p2);
        break;
      default:
        break;
    }
    return;
  }
  const result = Math.random() < 0.5;
  console.log("random" + result);
  if (result) {
    Battle(Player1, Player2, message);
    // return { attacker: Player1, defender: Player2 };
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
  console.log(Player1.hp, Player2.hp);
  setTimeout(() => {
    Turn(Player1, Player2, message, client, p1, p2, amount);
  }, 2500);
}

function BetterDuel(p1, p2, message, client, amount) {
  console.log(client);
  console.log("here");
  console.log("bd" + p1.name);
  console.log("bd" + p2.name);
  let Player1 = {
    name: p1.username,
    hp: 20,
    weapon: "",
  };
  let Player2 = {
    name: p2.username,
    hp: 20,
    weapon: "",
  };
  setTimeout(() => {
    Round(Player1, Player2, message, client, p1, p2, amount);
  }, 1000);
}

// function gameOver(loser, winner) {

// }

module.exports = { BetterDuel };
