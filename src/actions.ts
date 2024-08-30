import {
    ActionRowBuilder,
    APIEmbedField,
    ComponentType,
    EmbedBuilder,
    Message,
    StringSelectMenuBuilder, StringSelectMenuOptionBuilder
} from "discord.js";
import {Card} from "scryfall-api";
import axios, {AxiosResponse} from "axios";
import {CardList} from "./List.js";
import {getCardManaCost, getCardStats} from "./card-helpers.js";

const helpAction = (message: Message<boolean>, config) => {
    message.reply(`Search scryfall by typing "scryb " followed by any valid scryfall search syntax, which defaults to searching card names.\nFind the syntax here: https://scryfall.com/docs/syntax.\n"scryb! " will return a full art response rather than an embed.\nIf there are multiple results, you will be presented with a select to choose the card you want details on that will expire after ${config.selectTimeOut/1000} seconds.`);
}



const searchAction = async (message: Message<boolean>, query: string, imageOnly: boolean, config) => {
    let embeds: EmbedBuilder[];
    let components: ActionRowBuilder<StringSelectMenuBuilder>[];
    let selectCards: Card[];

    const processSearchResponse = (cards: CardList, limit = 15): {cardEmbed?: EmbedBuilder[], cardActions?: ActionRowBuilder<StringSelectMenuBuilder>[], cards?: Card[]} => {
        const totalCards = cards.total_cards ?? cards.data.length;

        const cardEmbed = new EmbedBuilder()
            .setColor(config.botColor)
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

            fields.push({name: `${card.name} | ${card.set.toUpperCase()}`, value: `${card.type_line}\n${getCardManaCost(card, config.getManaEmoji())}\n${getCardStats(card)}`, inline: true})
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

    const waitingMessage = await message.reply('Looking...');
    try{
        const response: AxiosResponse<CardList, any> = await axios.get(config.scryfallApiUrl, {params: {q: query}})

        if(response.data.data.length === 1){
            if(imageOnly){
                message.reply({content: `Match Found:`, files: [ response.data.data[0].image_uris.large]});
            }else {
                message.reply(`Match Found: ${ response.data.data[0].scryfall_uri}`);
            }
            return;
        }

        const {cardEmbed, cardActions, cards} = processSearchResponse(response.data);
        embeds = cardEmbed;
        components = cardActions
        selectCards = cards;


        const reply = await message.reply({ embeds, components});
        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: (i) => i.user.id === message.author.id,
            time: config.selectTimeOut,
            dispose: true
        })
        const selectTimeout = setTimeout(async ()=>{
            try{
                await reply.edit({content: 'Search Expired', embeds: [], components: []});
            }catch(error){
                console.log(error.code);
            }
        }, config.selectTimeOut)
        collector.on('collect', async (interaction)=> {
            if(!selectCards) return;

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
        const faeFrog = config.emotes.find((emote)=>emote.name === "FaeFrog");
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

export {helpAction, searchAction};