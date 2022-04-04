const cli = require("nodemon/lib/cli");
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

function getRandomItem(max, rarity) {
  let index = randomInt(max);
  return duelItems.weapons[rarity][index];
}

function getRandomEvent(max) {
  let index = randomInt(max);
  return duelItems.events[index];
}

function getWeapon(Player1, Player2, message) {
  if (Player1.weapon === "") {
    let rarity = randomInt(100) + 1;
    if (rarity <= 50) {
      rarity = "Common";
    } else if (rarity > 51 && rarity <= 80) {
      rarity = "Rare";
    } else {
      rarity = "Legendary";
    }
    let item = getRandomItem(duelItems.weapons[rarity].length, rarity);
    Player1.weapon = item;
    message.channel.send(
      `**${Player1.name}** picked up a ${Player1.weapon.name} **[${rarity}]** `
    );
  }
  if (Player2.weapon === "") {
    rarity = randomInt(100) + 1;
    if (rarity <= 40) {
      rarity = "Common";
    } else if (rarity >= 41 && rarity <= 75) {
      rarity = "Rare";
    } else {
      rarity = "Legendary";
    }
    item = getRandomItem(duelItems.weapons[rarity].length, rarity);
    Player2.weapon = item;
    message.channel.send(
      `**${Player2.name}** picked up a ${Player2.weapon.name} **[${rarity}]**`
    );
  }

  if (Player1.weapon.name === "Fists") {
    let roll = randomInt(100) + 1;
    if (roll < 40) {
      let rarity = randomInt(100) + 1;
      if (rarity <= 40) {
        rarity = "Common";
      } else if (rarity > 41 && rarity <= 75) {
        rarity = "Rare";
      } else {
        rarity = "Legendary";
      }
      item = getRandomItem(duelItems.weapons[rarity].length, rarity);
      Player1.weapon = item;
      message.channel.send(
        `**${Player1.name}** picked up a ${Player1.weapon.name} **[${rarity}]**`
      );
    }
    return;
  }
  if (Player2.weapon.name === "Fists") {
    let roll = randomInt(100) + 1;
    if (roll < 40) {
      let rarity = randomInt(100) + 1;
      if (rarity <= 40) {
        rarity = "Common";
      } else if (rarity > 41 && rarity <= 75) {
        rarity = "Rare";
      } else {
        rarity = "Legendary";
      }
      item = getRandomItem(duelItems.weapons[rarity].length, rarity);
      Player2.weapon = item;
      message.channel.send(
        `**${Player2.name}** picked up a ${Player2.weapon.name} **[${rarity}]**`
      );
    }
    return;
  }
}

function Turn(Player1, Player2, message, client, p1, p2, amount, duelCheck) {
  if (Player1.hp <= 0) {
    message.channel.send(
      `**${Player2.name}** wins! **${Player1.name}** handed over ${amount} points`
    );
    gameOver(Player2, message, client, p1, p2, amount);
    duelCheck();
    return;
  }
  if (Player2.hp <= 0) {
    message.channel.send(
      `**${Player1.name}** wins! **${Player2.name}** handed over ${amount} points`
    );
    gameOver(Player1, message, client, p1, p2, amount);
    duelCheck();
    return;
  }
  let eventChance = randomInt(100) + 1;
  if (eventChance < 5) {
    randomEvent(Player1, Player2, message, client, p1, p2, amount, duelCheck);
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

  Round(Player1, Player2, message, client, p1, p2, amount, duelCheck);
}

function Battle(attacker, defender, message) {
  let hit = randomInt(100) + 1;
  if (hit <= attacker.weapon.accuracy) {
    if (hit <= defender.evadeChance) {
      message.channel.send(
        ` **${attacker.name}**(${attacker.hp}HP) attacks! HOWEVER!, **${defender.name}**(${defender.hp}HP) evades it!`
      );
    } else if (defender.weapon.special !== null) {
      if (
        defender.weapon.special["type"] === "block" &&
        hit <= defender.weapon.special["value"]
      ) {
        message.channel.send(
          ` **${attacker.name}**(${attacker.hp}HP) attacks! HOWEVER!, **${defender.name}**(${defender.hp}HP) ${defender.weapon.special["message"]}!`
        );
        defender.weapon.special["value"] -= 5;
      } else {
        let strike = calculateDamage(
          attacker.weapon.minDamage,
          attacker.weapon.maxDamage,
          attacker.weapon.critChance
        );
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
    } else {
      let strike = calculateDamage(
        attacker.weapon.minDamage,
        attacker.weapon.maxDamage,
        attacker.weapon.critChance
      );
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
  } else {
    message.channel.send(`**${attacker.name}**(${attacker.hp}HP) missed!`);
  }

  if (defender.hp < 0) {
    return;
  }
  if (attacker.weapon.special !== null) {
    if (
      attacker.weapon.special["trigger-name"] === attacker.name &&
      attacker.weapon.special["used"] === false
    ) {
      if (attacker.weapon.special["type"] === "damage") {
        message.channel.send(
          `**${attacker.name}**(${attacker.hp}HP) activated their weapons ability!`
        );
        message.channel.send(`${attacker.weapon.special["message"]}`);
        message.channel.send(
          `**${defender.name}**(${defender.hp}HP) ${attacker.weapon.special["message-effect"]}`
        );
        attacker.weapon.special["used"] = true;
        defender.hp -= attacker.weapon.special["value"];
      } else if (attacker.weapon.special["type"] === "heal") {
        message.channel.send(
          `**${attacker.name}**(${attacker.hp}HP) activated their weapons ability!`
        );
        message.channel.send(`${attacker.weapon.special["message"]}`);
        message.channel.send(
          `**${attacker.name}**(${attacker.hp}HP) ${attacker.weapon.special["message-effect"]}`
        );
        attacker.weapon.special["used"] = true;
        attacker.hp += attacker.weapon.special["value"];
      }
    }
  } else if (defender.weapon.special !== null) {
    if (
      defender.weapon.special["trigger-name"] === defender.name &&
      defender.weapon.special["used"] === false
    ) {
      if (defender.weapon.special["type"] === "heal") {
        message.channel.send(
          `**${defender.name}**(${defender.hp}HP) activated their weapons ability!`
        );
        message.channel.send(`${defender.weapon.special["message"]}`);
        message.channel.send(
          `**${defender.name}**(${defender.hp}HP) ${defender.weapon.special["message-effect"]}`
        );
        defender.weapon.special["used"] = true;
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
      maxDamage: 6,
      minDamage: 4,
      critChance: 20,
      accuracy: 90,
      breakChance: 0,
      special: null,
    };
  }
}

function Round(Player1, Player2, message, client, p1, p2, amount, duelCheck) {
  getWeapon(Player1, Player2, message);
  setTimeout(() => {
    Turn(Player1, Player2, message, client, p1, p2, amount, duelCheck);
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

function randomEvent(
  Player1,
  Player2,
  message,
  client,
  p1,
  p2,
  amount,
  duelCheck
) {
  let event = getRandomEvent(duelItems.events.length);
  message.channel.send(`**!!! EVENT !!!**`);
  setTimeout(() => {
    message.channel.send(`${event.message}`);
    message.channel.send(`${event.attack}`);
    setTimeout(() => {
      getEventResult(event, Player1, Player2, message);
      Round(Player1, Player2, message, client, p1, p2, amount, duelCheck);
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

function BetterDuel(p1, p2, message, client, amount, duelCheck) {
  // let hp = getHP(amount);
  let hp = 25;
  let Player1 = {
    name: p1.username,
    hp: hp,
    weapon: "",
    attacking: false,
    evadeChance: 2,
  };
  let Player2 = {
    name: p2.username,
    hp: hp,
    weapon: "",
    attacking: false,
    evadeChance: 2,
  };
  let result = Math.random() < 0.5;
  if (result) {
    Player1.attacking = true;
  } else {
    Player2.attacking = true;
  }
  setTimeout(() => {
    Round(Player1, Player2, message, client, p1, p2, amount, duelCheck);
  }, 1000);
}

module.exports = { BetterDuel };
