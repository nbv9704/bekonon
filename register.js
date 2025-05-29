const fs = require('fs').promises;
const path = require('path');

async function registerCommands(client) {
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = await fs.readdir(commandsPath);

  // Load all commands from the commands directory
  for (const file of commandFiles) {
    if (file.endsWith('.js') && file !== 'grab.js') {
      const command = require(path.join(commandsPath, file));
      // Xóa dòng console.log chi tiết
      // console.log(`Loading command from ${file}:`, command, 'Data:', command.data);
      if (command.data && typeof command.data.toJSON === 'function') {
        commands.push(command.data.toJSON());
        console.log(`Loaded command: ${command.data.name}`); // Log nhẹ nhàng hơn (tùy chọn)
      } else {
        console.warn(`File ${file} does not contain valid command data, skipping.`);
      }
    }
  }

  try {
    // Clear all global commands first
    await client.application.commands.set([]);
    console.log('Cleared all global commands');

    // Register commands for each guild
    const guilds = client.guilds.cache;
    for (const [guildId, guild] of guilds) {
      // Clear all old commands in the guild
      await guild.commands.set([]);
      console.log(`Cleared old commands in guild ${guild.name} (ID: ${guildId})`);

      // Register new commands
      await guild.commands.set(commands);
      console.log(`Registered commands for guild ${guild.name} (ID: ${guildId})`);
    }

    console.log('Registered command list:', commands.map(cmd => cmd.name));
    console.log('Finished registering slash commands for all guilds!');
  } catch (error) {
    console.error('Error syncing commands:', error.stack);
  }
}

module.exports = registerCommands;