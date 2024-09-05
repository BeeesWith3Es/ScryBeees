import {
    ActionRowBuilder,
    APIEmbedField,
    ComponentType,
    EmbedBuilder,
    Message,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder
} from "discord.js";
import {Card} from "scryfall-api";
import axios, {AxiosResponse} from "axios";
import {CardList} from "./List.js";
import {faceDelimiter, getCardManaCost, getCardOracleText, getCardStats, insertManaSymbols} from "./card-helpers.js";

interface SearchResponseData{
    cardEmbeds?: EmbedBuilder[];
    cardActions?: ActionRowBuilder<StringSelectMenuBuilder>[];
    cards?: Card[]
}

const missingImageUrl = "https://errors.scryfall.com/missing.jpg"

export const helpAction = (message: Message<boolean>, config) => {
    message.reply(`Search scryfall by typing "scryb " followed by any valid scryfall search syntax, which defaults to searching card names.\nFind the syntax here: https://scryfall.com/docs/syntax.\n"scryb! " will return a full art response rather than an embed.\nIf there are multiple results, you will be presented with a select to choose the card you want details on that will expire after ${config.selectTimeOut/1000} seconds.`);
}

export const searchAction = async (message: Message<boolean>, options) => {
    let embeds: EmbedBuilder[];
    let components: ActionRowBuilder<StringSelectMenuBuilder>[];
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
            .setCustomId(message.id)
            .setMinValues(1)
            .setMaxValues(selectOptions.length<=9 ? selectOptions.length: 9)
            .setPlaceholder('Select Card to get details')
            .addOptions(selectOptions.map((option)=>{
                return new StringSelectMenuOptionBuilder()
                    .setLabel(option.label)
                    .setDescription(option.description)
                    .setValue(option.value)
            }))

        const cardActions = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(cardSelect);

        return {
            cardEmbeds: [cardEmbed],
            cardActions: [cardActions],
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
        console.log(getCardStats(card));
        return new EmbedBuilder()
            .setColor(options.botColor)
            .setTitle(`${card.name.replace(/\/\//, faceDelimiter)} — ${getCardManaCost(card, options.getManaEmoji())}`)
            .setDescription(description)
            .setThumbnail(getCardImageOrFaces(card)[0]);
    }

    const waitingMessage = await message.reply('Looking...');
    try{
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
        const collector = reply.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: (i) => i.user.id === message.author.id,
            time: options.selectTimeOut,
            dispose: true
        })
        const selectTimeout = setTimeout(async ()=>{
            try{
                await reply.edit({content: 'Search Expired', components: []});
            }catch(error){
                console.log(error.code);
            }
        }, options.selectTimeOut)
        collector.on('collect', async (interaction)=> {
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
