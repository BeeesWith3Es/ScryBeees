import axios, { AxiosResponse } from 'axios';
import { Client, IntentsBitField, EmbedBuilder, Embed, APIEmbedField, GuildEmoji, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ActionRowBuilder, ComponentType } from 'discord.js';
import dotenv from 'dotenv';
import { CardList, getCardNames } from './List.js';
import { Card } from 'scryfall-api';
import { create } from 'domain';
import { getCardManaCost, getCardStats } from './card-helpers.js';

dotenv.config();

const keyPhrase = 'scryb';
const addEmojiPhrase = 'add ';
const helpPhrases = ['scryb?', 'scryb ?', 'scryb h', 'scryb help'];
const scryfallApiUrl =  'https://api.scryfall.com/cards/search'
const botColor = 0xFFFC30;
const selectTimeOut = 30_000;
 
let emotes: GuildEmoji[] = [];
const manaServerName = 'TheManaBase'
const manaServerName2 = 'TheManaBase2'
let manaEmoji;
const getManaEmoji = () => {
    if(!manaEmoji)
        manaEmoji = emotes.filter((val)=>val.guild.name === manaServerName || val.guild.name === manaServerName2);
    return manaEmoji;
}
    

const botClient = new Client({
    intents: [
        IntentsBitField.Flags.Guilds,
        IntentsBitField.Flags.GuildMessages,
        IntentsBitField.Flags.GuildMembers,
        IntentsBitField.Flags.GuildEmojisAndStickers,
        IntentsBitField.Flags.MessageContent
    ],
    allowedMentions: {repliedUser: false}
});

const createSearchEmbed = (cards: CardList, limit = 15): {cardEmbed?: EmbedBuilder[], cardActions?: ActionRowBuilder<StringSelectMenuBuilder>[], cards?: Card[]} => {
    const totalCards = cards.total_cards ?? cards.data.length;

    const cardEmbed = new EmbedBuilder()
    .setColor(botColor)
    .setTitle('Results: ')
    .setDescription(`${totalCards} card${totalCards === 1 ? '' : 's'} found`);

    if(totalCards === 0){
        return {cardEmbed: [cardEmbed]};
    }

    if(totalCards === 1){
       return {cardEmbed: [cardEmbed.setTitle('Card Found').setDescription(null).setImage(cards.data[0].image_uris.normal)]}
    }

    const selectOptions = []

    const createOption = (label: string, description: string, value: string, emoji?: string) => {
        return {
            label,
            description,
            value,
            emoji
        }
    }

    const fields: APIEmbedField[] = [];
    for(let i=0; i<(limit > cards.data.length ? cards.data.length : limit) ; i++){
        const card = cards.data[i]
        selectOptions.push(createOption(`${card.name} | ${card.set.toUpperCase()}`, `${card.type_line} ${getCardStats(card)}`, `${i}`))
        
        fields.push({name: `${card.name} | ${card.set.toUpperCase()}`, value: `${card.type_line}\n${getCardManaCost(card, getManaEmoji())}\n${getCardStats(card)}`, inline: true})
    }

    cardEmbed.addFields(...fields);
    const cardSelect = new StringSelectMenuBuilder()
    .setCustomId('0')
    .setMinValues(1)
    .setMaxValues(selectOptions.length)
    .setPlaceholder('Select Card to get details')
    .addOptions(selectOptions.map((option)=>{
        return new StringSelectMenuOptionBuilder()
        .setLabel(option.label)
        .setDescription(option.description)
        .setValue(option.value)
    }))

    const cardActions = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(cardSelect);

    return {
        cardEmbed: [cardEmbed],
        cardActions: [cardActions],
        cards: cards.data.slice(0, limit > cards.data.length ? cards.data.length : limit)
    };
}

botClient.on('ready', (client)=>{
    console.log(`Ready at ${new Date(client.readyTimestamp)}`);
    emotes = Array.from(client.emojis.valueOf().values());
    const faeFrog = emotes.find((emote)=>emote.name === "FaeFrog");
    console.log(`Emoji Loaded at ${new Date()} <:${faeFrog.name}:${faeFrog.id}>`);
})


    botClient.on('messageCreate', async (message)=>{
        try{
            if(message.author.bot){
                return;
            }

            
            if(helpPhrases.find((val)=>val === message.content.toLowerCase().split(' ')[0])){
                message.reply(`Search scryfall by typeing "scryb " followed by any valid scryfall search syntax, which defaults to searching card names.\nFind the syntax here: https://scryfall.com/docs/syntax.\n"scryb! " will return a full art response rather than an embed.\nIf there are multiple results, you will be presented with a select to choose the card you want details on that will expire after ${selectTimeOut/1000} seconds.`);
                return;
            }
            
            if(message.content.toLowerCase().startsWith(keyPhrase)){
        
                const query = message.content.toLowerCase().replace(keyPhrase, '');
                let imageOnly = false;
                if(query.startsWith('!')) {
                    imageOnly = true;
                    query.replace('!', '');
                }
                query.trim();
                
                let embeds: EmbedBuilder[];
                let components: ActionRowBuilder<StringSelectMenuBuilder>[];
                let content: string;
                let selectCards: Card[];
        
                const waitingMessage = await message.reply('Looking...');
                try{
                    const response: AxiosResponse<CardList, any> = await axios.get(scryfallApiUrl, {params: {q: query}})
        
                    if(response.data.data.length === 1){
                        if(imageOnly){
                            message.reply({content: `Match Found:`, files: [ response.data.data[0].image_uris.large]});
                        }else {
                            message.reply(`Match Found: ${ response.data.data[0].scryfall_uri}`);
                        }
                        return;
                    }
        
                    const {cardEmbed, cardActions, cards} = createSearchEmbed(response.data);
                    embeds = cardEmbed;
                    components = cardActions
                    selectCards = cards;
        
        
                    const reply = await message.reply({ content, embeds, components});
                    const collector = reply.createMessageComponentCollector({
                        componentType: ComponentType.StringSelect,
                        filter: (i) => i.user.id === message.author.id,
                        time: selectTimeOut,
                        dispose: true
                    })
                    const selectTimeout = setTimeout(async ()=>{
                        try{
                        await reply.edit({content: 'Search Expired', embeds: [], components: []});
                        }catch(error){
                            console.log(error.code);
                        }
                    }, selectTimeOut)
                    collector.on('collect', async (interaction)=> {
                        if(!selectCards) return;
            
                        if(imageOnly && interaction.values.length === 1){
                            
                            return;
                        }
                        const cardUris = interaction.values
                        .filter((val)=>(!Number.isNaN(Number(val))))
                        .map((val)=>{
                            const card = selectCards[Number(val)];
                            if(imageOnly) return card.image_uris.large ?? "NO IMAGE";
                            return card.scryfall_uri;
                        });
            
                        if(imageOnly){
                            const attachments = cardUris
                            .map((uri)=>({attachment: uri}));
                            await message.reply({files: attachments});
                        }else {
                            await message.reply({content: `Results:\n${cardUris.reduce((result, next)=>`${result}\n${next}`)}`});
                        }
                        clearTimeout(selectTimeout);
                        interaction.message.delete();
                    })
                }catch(error){
                    const faeFrog = emotes.find((emote)=>emote.name === "FaeFrog");
                    if(error.status === 404){
                        message.reply(`<:${faeFrog.name}:${faeFrog.id}>\nYour query didn’t match any cards. Adjust your search terms or refer to the syntax guide at <https://scryfall.com/docs/reference>`);
                    }else{
                        console.log("Error during message received\n", error, '\nMessage:\n', message);
                        message.reply(`<:${faeFrog.name}:${faeFrog.id}>\nThere was an error in processing your request: "${error.response.data.details}"\nBut I did not crash, try again!`);
                    }
                }finally{
                    waitingMessage.delete();
                }
            }
        
            // if(message.content.toLowerCase().startsWith(addEmojiPhrase)){
            //     try{
            //         const emoteRegex = /<:(.+):(\d+)>/gm;
            //         const emojiUris = message.content.replace(addEmojiPhrase, '').split(' ').map((emote)=>{
            //             const extractedEmote = emoteRegex.exec(emote);
            //             const url =  `https://cdn.discordapp.com/emojis/${extractedEmote?.[2]}.png?v=1`
            //             const name = extractedEmote?.[1]//.replace('mana', 'mana_');
            //             emoteRegex.lastIndex = 0;
            //             console.log(extractedEmote);
            //             return {url, name};
            //         })
            //         .forEach((emojiUri)=>{message.guild.emojis.create({name: emojiUri.name.replace('mana', 'mana_'), attachment: emojiUri.url})});
                    
            //     }catch(error){
            //         console.log("OOOOOPS!!!", error)
            //     }
            // }

        }catch(error){
            console.log("Error during message received\n", error, '\nMessage:\n', message);
            message.reply(`There was an error in processing your request: "${error.message}"\nBut I did not crash, try again!`);
        }
    })

botClient.login(process.env.BOT_TOKEN);