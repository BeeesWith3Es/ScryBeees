import {
    ActionRowBuilder,
    APIEmbedField, ButtonBuilder,
    ComponentType,
    EmbedBuilder,
    Message,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonStyle, PermissionsBitField
} from "discord.js";
import {Card} from "scryfall-api";
import axios, {AxiosResponse} from "axios";
import {CardList} from "./List.js";
import {
    faceDelimiter,
    getCardManaCost,
    getCardOracleText,
    getCardStats,
    insertManaSymbols,
    scryfallIcon
} from "./card-helpers.js";
import * as repl from "node:repl";

interface SearchResponseData{
    cardEmbeds?: EmbedBuilder[];
    cardActions?: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[];
    cards?: Card[]
}

const missingImageUrl = "https://errors.scryfall.com/missing.jpg"

export const helpAction = (message: Message<boolean>, config) => {
    message.reply(`Search scryfall by typing any valid scryfall search syntax within <<>> or (()). Typing only words will search by card name.\nFind the syntax here: https://scryfall.com/docs/syntax.\nIf there are multiple results, you will be presented with a select to choose the card you want details on that will expire after ${config.selectTimeOut/1000} seconds. This selector will be DM'd to you if you used the (()) option. \nPrefix your query with ! for full images, or @ to receive a link to your search on Scryfall itself.`);
}

export const searchAction = async (message: Message<boolean>, options) => {
    let embeds: EmbedBuilder[];
    let components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[];
    let selectCards: Card[];
    const {queryOption, query, privateSelect} = options;

    const imageOnly = queryOption === options.imageOption;

    const processSearchResponse = (cards: CardList, limit = 15): SearchResponseData => {
        const totalCards = cards.total_cards ?? cards.data.length;

        const cardEmbed = new EmbedBuilder()
            .setColor(options.botColor)
            .setTitle('Results: ')
            .setDescription(`${totalCards} card${totalCards === 1 ? '' : 's'} found`);

        if(totalCards === 0){
            return {cardEmbeds: [cardEmbed]};
        }

        if(totalCards === 1){
            return {cardEmbeds: [cardEmbed.setTitle('Card Found').setDescription(null).setImage(cards.data[0].image_uris.normal)]}
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
            fields.push({name: `${card.name.replace(/\/\//, faceDelimiter)} | ${card.set.toUpperCase()}`, value: `${card.type_line.replace(/\/\//, faceDelimiter)}\n${getCardManaCost(card, options.getManaEmoji())}\n${getCardStats(card)}`, inline: true})
            selectOptions.push(createOption(`${card.name.replace(/\/\//, faceDelimiter)} | ${card.set.toUpperCase()}`, `${card.type_line.replace(/\/\//, faceDelimiter)} ${getCardStats(card, false)}`, `${i}`))
        }

        cardEmbed.addFields(...fields);
        const cardSelect = new StringSelectMenuBuilder()
            .setCustomId(`card-select-${message.id}`)
            .setMinValues(1)
            .setMaxValues(selectOptions.length<=9 ? selectOptions.length: 9)
            .setPlaceholder('Select Card to get details')
            .addOptions(selectOptions.map((option)=>{
                return new StringSelectMenuOptionBuilder()
                    .setLabel(option.label)
                    .setDescription(option.description)
                    .setValue(option.value)
            }))
        const deleteButton = new ButtonBuilder()
            .setCustomId(`delete-button-${message.id}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Delete')

        const cardActions = [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(cardSelect),
            new ActionRowBuilder<ButtonBuilder>().addComponents(deleteButton)
        ];

        return {
            cardEmbeds: [cardEmbed],
            cardActions: cardActions,
            cards: cards.data.slice(0, limit > cards.data.length ? cards.data.length : limit)
        };
    }

    const getCardImageOrFaces = (card: Card): string[] => {
        if(card.image_status === "missing") return [missingImageUrl];
        if(card.card_faces && card.card_faces.length >=1) return card.card_faces.map((face)=>face?.image_uris?.large ?? missingImageUrl);
        return [card?.image_uris?.large ?? missingImageUrl];
    }

    const createCardDetailEmbed = (card: Card): EmbedBuilder => {
        const description = `${card.type_line.replace(/\/\//, faceDelimiter)}\n\n${getCardOracleText(card, options.getManaEmoji())}\n\n${getCardStats(card)}`
        return new EmbedBuilder()
            .setColor(options.botColor)
            .setTitle(`${card.name.replace(/\/\//, faceDelimiter)} — ${getCardManaCost(card, options.getManaEmoji())}`)
            .setDescription(description)
            .setThumbnail(getCardImageOrFaces(card)[0])
            .setFields({name: 'Scryfall Link:', value: card.scryfall_uri});
    }

    const waitingMessage = await message.reply('Looking...');
    try{
        if(options.queryOption === options.linkOption){
            const params = new URLSearchParams();
            params.append('q', options.query);
            params.append('as', 'grid');
            if(options.privateSelect){
                message.author.send(`Scryfall Search Page:\n${options.scryfallSearchPageUrl}?${params.toString()}`)
                message.reply('Delivered personally!')
            }else {
                message.reply(`Scryfall Search Page:\n${options.scryfallSearchPageUrl}?${params.toString()}`)
            }
            return;
        }

        const response: AxiosResponse<CardList, any> = await axios.get(options.scryfallApiCardSearchUrl, {params: {q: query}})

        if(response.data.data.length === 1){
            const card = response.data.data[0];
            if(imageOnly){
                message.reply({content: `Match Found:`, files: getCardImageOrFaces(card)});
            }else {
                message.reply({content: `Match Found: \n${'<'+card.scryfall_uri+'>'}`, embeds: [createCardDetailEmbed(card)]});
            }
            return;
        }

        const {cardEmbeds, cardActions, cards} = processSearchResponse(response.data);
        embeds = cardEmbeds;
        components = cardActions
        selectCards = cards;


        const reply = privateSelect ? await message.author.send({embeds, components}) : await message.reply({ embeds, components});
        const selectCollector = reply.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: (i) => i.user.id === message.author.id,
            time: options.selectTimeOut,
            dispose: true
        });
        const buttonCollector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === message.author.id || (i.member.permissions as Readonly<PermissionsBitField>).has(PermissionsBitField.Flags.ManageMessages)
        })
        const selectTimeout = setTimeout(async ()=>{
            try{
                const deleteComponent = reply.components[1];
                await reply.edit({content: 'Search Expired', components: [deleteComponent]});
            }catch(error){
                console.log(error.code);
            }
        }, options.selectTimeOut)
        selectCollector.on('collect', async (interaction)=> {
            if(!selectCards) return;

            const selectedCards = interaction.values
                .filter((val)=>(!Number.isNaN(Number(val))))
                .map((val)=>{
                    return selectCards[Number(val)];
                });

            if(imageOnly){
                const attachments = selectedCards
                    .map((card)=>({attachment: getCardImageOrFaces(card)[0]}));
                await message.reply({files: attachments});
            }else {
                await message.reply({content: `Results:`, embeds: selectedCards.map(createCardDetailEmbed)});
            }
            clearTimeout(selectTimeout);
            interaction.message.delete();
        });
        buttonCollector.on('collect', async (interaction) => {
            if(interaction.customId === `delete-button-${message.id}`){
                interaction.message.delete();
            }
        })

    }catch(error){
        const faeFrog = options.emotes.find((emote)=>emote?.name === "FaeFrog");
        if(error.status === 404){
            message.reply(`<:${faeFrog?.name}:${faeFrog?.id}>\nYour query didn’t match any cards. Adjust your search terms or refer to the syntax guide at <https://scryfall.com/docs/reference>`);
        }else{
            console.log("Error during message received\n", error, '\nMessage:\n', message);
            message.reply(`<:${faeFrog?.name}:${faeFrog?.id}>\nThere was an error in processing your request: "${error?.response?.data?.details ?? error?.message}"\nBut I did not crash, try again!`);
        }
    }finally{
        waitingMessage.delete();
    }
}
