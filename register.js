const fs = require('fs').promises;
const path = require('path');
const { setTimeout } = require('timers/promises');

async function registerCommands(client) {
  console.log('Starting command registration...');
  const commands = [];
  const commandsPath = path.join(__dirname, 'commands');
  const commandFiles = await fs.readdir(commandsPath);

  console.log('Loading commands from directory:', commandsPath);
  for (const file of commandFiles) {
    if (file.endsWith('.js') && file !== 'grab.js') {
      const command = require(path.join(commandsPath, file));
      if (command.data && typeof command.data.toJSON === 'function') {
        commands.push(command.data.toJSON());
        console.log(`Loaded command: ${command.data.name}`);
      } else {
        console.warn(`File ${file} does not contain valid command data, skipping.`);
      }
    }
  }

  try {
    // Clear all global commands first
    console.log('Clearing all global commands...');
    await Promise.race([
      client.application.commands.set([]),
      setTimeout(60000).then(() => { throw new Error('Timeout: Failed to clear global commands after 60 seconds'); }),
    ]);
    console.log('Cleared all global commands');

    // Register global commands (tạm thời để tránh rate limit per-guild)
    console.log('Registering global commands...');
    console.log(`Total commands to register: ${commands.length}`);
    let retries = 3;
    let success = false;
    while (retries > 0 && !success) {
      try {
        await Promise.race([
          client.application.commands.set(commands),
          setTimeout(60000).then(() => { throw new Error('Timeout: Failed to register global commands after 60 seconds'); }),
        ]);
        console.log('Registered global commands:', commands.map(cmd => cmd.name));
        console.log('Finished registering slash commands globally!');
        success = true;
      } catch (error) {
        retries--;
        console.error(`Failed to register global commands - Retries left: ${retries}`, error.stack);
        if (retries > 0) {
          console.log('Retrying in 10 seconds...');
          await setTimeout(10000); // Đợi 10 giây trước khi thử lại
        } else {
          console.error('Exhausted retries for global command registration');
          throw error;
        }
      }
    }
  } catch (error) {
    console.error('Error syncing commands:', error.stack);
    throw error;
  }
}

module.exports = registerCommands; 