const path = require('path');
const readdir = require('fs-readdir-recursive');
const chalk = require('chalk');

const Manager = require('./manager');

class CommandManager extends Manager {
    getName() {
        return 'commands';
    }

    preInit() {
        this._commands = [];
        this.loadCommands();
    }

    init() {
        const bot = this.bot;

        this._commands.filter(command => command && command.init)
            .forEach(command => command.init(bot));
    }

    validateCommand(command) {
        if (typeof command !== 'object') return 'Exports are empty';
        if (typeof command.run !== 'function') return 'Missing run function';
        if (typeof command.info !== 'object') return 'Missing info object';
        if (typeof command.info.name !== 'string') return 'Info object missing "name"';
        if (typeof command.info.usage !== 'string') return 'Info object missing "usage"';
        if (typeof command.info.description !== 'string') return 'Info object missing "description"';
        return '';
    }

    loadCommands() {
        const commandsFolder = path.resolve(__dirname, '..', 'commands');

        readdir(commandsFolder)
            .filter(file => !path.basename(file).startsWith('_') && file.endsWith('.js'))
            .forEach(file => {
                try {
                    const command = require(path.resolve(commandsFolder, file));
                    const check = this.validateCommand(command);

                    if (check) {
                        return console.error(`Error in '${file}': ${chalk.red(check)}`);
                    }

                    if (this.findCommand(command.info.name)) {
                        return console.error(`Duplicate command: An entry already exists for command ${chalk.red(command.info.name)} in file '${file}'`);
                    }

                    this._commands.push(command);
                } catch (error) {
                    console.error(`Failed to load command file '${file}': ${error}`);
                }
            });
    }

    findCommand(input) {
        return this._commands.find(command => {
            return command.info.name.toLowerCase() === input.toLowerCase() ||
                (command.info.aliases && command.info.aliases.find(alias => alias.toLowerCase() === input.toLowerCase()));
        });
    }

    _checkPermissions(member, command) {
        if (command.info.perms) {
            let perms = command.info.perms;
            if (!(command.info.perms instanceof Array)) {
                perms = [perms];
            }

            for (const key in perms) {
                const perm = perms[key];
                if (!member.hasPermission(perm)) {
                    return `You need the permission \`${perm}\` to use this command.`;
                }
            }
        }

        if (command.info.ownerOnly && member.id !== (global.config.ownerID || '138048234819026944')) {
            return 'Only the owner of the bot can use this command.';
        }

        return '';
    }

    get commands() {
        return this._commands.slice(0);
    }

    async onMessage(message) {
        const prefix = global.config.prefix;

        if (!message.content.startsWith(prefix)) {
            return;
        }

        const split = message.content.substr(prefix.length).trim().split(' ');
        const base = split[0];
        const args = split.slice(1);

        const command = this.findCommand(base);

        if (!command) {
            return;
        }

        const permMessage = this._checkPermissions(message.member, command);
        if (permMessage) {
            return message.channel.send(`:no_entry_sign: ${permMessage}`)
                .then(m => m.delete(5000));
        }

        try {
            await command.run(this.bot, message, args);
        } catch (err) {
            message.channel.send(`:x: ${err && err.message || err || 'An unknown error has occurred!'}`)
                .then(m => m.delete(5000));
        }
    }
}

module.exports = CommandManager;