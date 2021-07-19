/**
 * @name VoiceChatMoveAll
 * @description A context menu utility to move everyone to a certain voice channel.
 * @version 2.0.0
 * @source https://github.com/slow/better-discord-plugins/blob/master/VoiceChatMoveAll/VoiceChatMoveAll.plugin.js
 * @updateUrl https://raw.githubusercontent.com/slow/better-discord-plugins/master/VoiceChatMoveAll/VoiceChatMoveAll.plugin.js
 * @author eternal
 * @authorId 282595588950982656
 * @donate https://paypal.me/eternal404
 */

/*@cc_on
@if (@_jscript)

    // Offer to self-install for clueless users that try to run this directly.
    var shell = WScript.CreateObject("WScript.Shell");
    var fs = new ActiveXObject("Scripting.FileSystemObject");
    var pathPlugins = shell.ExpandEnvironmentStrings("%APPDATA%\\BetterDiscord\\plugins");
    var pathSelf = WScript.ScriptFullName;
    // Put the user at ease by addressing them in the first person
    shell.Popup("It looks like you've mistakenly tried to run me directly. \n(Don't do that!)", 0, "I'm a plugin for BetterDiscord", 0x30);
    if (fs.GetParentFolderName(pathSelf) === fs.GetAbsolutePathName(pathPlugins)) {
        shell.Popup("I'm in the correct folder already.", 0, "I'm already installed", 0x40);
    } else if (!fs.FolderExists(pathPlugins)) {
        shell.Popup("I can't find the BetterDiscord plugins folder.\nAre you sure it's even installed?", 0, "Can't install myself", 0x10);
    } else if (shell.Popup("Should I copy myself to BetterDiscord's plugins folder for you?", 0, "Do you need some help?", 0x34) === 6) {
        fs.CopyFile(pathSelf, fs.BuildPath(pathPlugins, fs.GetFileName(pathSelf)), true);
        // Show the user where to put plugins in the future
        shell.Exec("explorer " + pathPlugins);
        shell.Popup("I'm installed!", 0, "Successfully installed", 0x40);
    }
    WScript.Quit();

@else@*/

const { findModuleByProps, findModule, Patcher, React } = BdApi;
const sleep = (time) => new Promise((f) => setTimeout(f, time));

const VCContextMenu = findModule(m => m.default && m.default.displayName == 'ChannelListVoiceChannelContextMenu');
const { getVoiceStatesForChannel } = findModuleByProps('getVoiceStatesForChannel');
const DiscordPermissions = findModuleByProps('Permissions').Permissions;
const { getVoiceChannelId } = findModuleByProps('getVoiceChannelId');
const Menu = findModuleByProps('MenuGroup', 'MenuItem');
const Permissions = findModuleByProps('getHighestRole');
const { getChannel } = findModuleByProps('getChannel');
const { Endpoints } = findModuleByProps('Endpoints');
const { getGuild } = findModuleByProps('getGuild');
const { patch } = findModuleByProps('patch');

class VoiceChatMoveAll {
   start() {
      Patcher.after('voice-chat-move-all', VCContextMenu, 'default', (_, args, res) => {
         let channel = args[0].channel;
         if (!channel || !channel.guild_id || !this.canMoveAll(channel)) return res;
         let currentChannel = this.getVoiceChannel();
         if (!currentChannel || currentChannel.members.length < 2) return res;

         let item = React.createElement(Menu.MenuItem, {
            action: async () => {
               for (const member of currentChannel.members) {
                  await patch({
                     url: Endpoints.GUILD_MEMBER(channel.guild_id, member),
                     body: {
                        channel_id: channel.id
                     }
                  }).catch(async (e) => {
                     await sleep(e.body.retry_after * 1000);
                     currentChannel.members.unshift(member);
                  });
               }
            },
            id: 'move-all-vc',
            label: 'Move All'
         });

         let element = React.createElement(Menu.MenuGroup, null, item);
         res.props.children.push(element);
         return res;
      });
   }

   stop() {
      Patcher.unpatchAll('voice-chat-move-all');
   }

   getVoiceUserIds(channel) {
      if (!channel) return null;
      return Object.keys(getVoiceStatesForChannel(channel));
   }

   canMoveAll(channel) {
      let instance = this.getVoiceChannel();

      if (
         instance?.channel.id !== channel.id &&
         instance?.channel.guild_id === channel.guild_id &&
         (
            Permissions.can(DiscordPermissions.ADMINISTRATOR, getGuild(channel.guild_id)) ||
            (this.canJoinAndMove(channel) && (channel.userLimit == 0 || channel.userLimit - instance.count >= 0))
         )
      ) return true;

      return false;
   }

   canJoinAndMove(channel) {
      return Permissions.can(DiscordPermissions.CONNECT, channel) && Permissions.can(DiscordPermissions.MOVE_MEMBERS, channel);
   }

   getVoiceChannel() {
      let channel = getChannel(getVoiceChannelId());
      let members = this.getVoiceUserIds(channel?.id);
      if (channel && members) return { channel, members, count: members.length };
      return null;
   }
};
