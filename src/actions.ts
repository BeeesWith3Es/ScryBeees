import {
    ActionRowBuilder,
    ButtonBuilder,
    ComponentType,
    EmbedBuilder,
    Message,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
    ButtonStyle,
    PermissionsBitField,
    StringSelectMenuInteraction,
} from "discord.js";
import {Card} from "scryfall-api";
import {CardList} from "./List.js";
import {
    faceDelimiter,
    getCardManaCost,
    getCardOracleText,
    getCardStats,
} from "./card-helpers.js";
import {usePagination} from "./usePagination.js";
import {createCardFields, createCardSelectOptions, createPageSelect, createPageText} from "./select-helper.js";
import pjson from "../package.json";

interface SearchResponseData{
    cardEmbeds?: EmbedBuilder[];
    cardActions?: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[];
    cards?: Card[]
}

const missingImageUrl = "https://errors.scryfall.com/missing.jpg";
const cardSelectIdPrefix = 'cs';
const pageSelectIdPrefix = 'ps';

const { getDataForFirstPage , getDataForSubPage, getNumberOfSubPages, prettyPrintCache, getDataForPage } = usePagination('https://api.scryfall.com/cards/search');

export const helpAction = (message: Message<boolean>, config) => {
    message.reply(`Search scryfall by typing any valid scryfall search syntax within <<>> or (()). Typing only words will search by card name.\nFind the syntax here: https://scryfall.com/docs/syntax.\nIf there are multiple results, you will be presented with a select to choose the card you want details on that will expire after ${config.selectTimeOut/1000} seconds. This selector will be DM'd to you if you used the (()) option. \nPrefix your query with ! for full images, or @ to receive a link to your search on Scryfall itself.\n\nScrybeees Version ${pjson.version}`);
}

export const searchAction = async (message: Message<boolean>, config) => {
    let embeds: EmbedBuilder[];
    let components: ActionRowBuilder<StringSelectMenuBuilder | ButtonBuilder>[];
    const {queryOption, query, privateSelect} = config;

    const imageOnly = queryOption === config.imageOption;

    const startTimeOutInteraction = (interaction: StringSelectMenuInteraction) => {
        return setTimeout(async ()=>{
            try{
                const deleteComponent = interaction.message.components[2];
                await interaction.message.edit({content: 'Search Expired', components: [deleteComponent]});
            }catch(error){
                console.log('Failed to expire interaction:', error.code);
            }
        }, config.selectTimeOut)
    }

    const startTimeOut = (reply: Message<boolean>) => {
        return setTimeout(async ()=>{
            try{
                const deleteComponent = reply.components[2];
                await reply.edit({content: 'Search Expired', components: [deleteComponent]});
            }catch(error){
                console.log('Failed to expire interaction:', error.code);
            }
        }, config.selectTimeOut)
    }

    const processSearchResponse = (cardList: CardList, queryKey: string, limit = 9): SearchResponseData => {
        const totalCards = cardList.total_cards ?? cardList.data.length;

        const cardEmbed = new EmbedBuilder()
            .setColor(config.botColor)
            .setDescription(`${totalCards} card${totalCards === 1 ? '' : 's'} found`)

        if(totalCards === 0){
            return {cardEmbeds: [cardEmbed]};
        }

        if(totalCards === 1){
            return {cardEmbeds: [cardEmbed.setTitle('Card Found').setDescription(null).setImage(cardList.data[0].image_uris.normal)]}
        }

        const selectableCards = cardList.data.slice(0, limit);

        const selectOptions = createCardSelectOptions(selectableCards);
        const fields = createCardFields(selectableCards, config.getManaEmoji());

        cardEmbed.addFields(...fields);
        const cardSelect = new StringSelectMenuBuilder()
            .setCustomId(`${cardSelectIdPrefix}:${queryKey}:0:${Math.floor(Math.random()*99999)}`)
            .setMinValues(1)
            .setMaxValues(selectableCards.length<=9 ? selectableCards.length: 9)
            .setPlaceholder('Select Card to get details')
            .addOptions(selectOptions.map((option)=>{
                return new StringSelectMenuOptionBuilder()
                    .setLabel(option.label)
                    .setDescription(option.description)
                    .setValue(option.value)
            }))
        const subPages: number = getNumberOfSubPages(queryKey);
        cardEmbed.setFooter({text: createPageText(1, subPages)});
        const pageSelect = createPageSelect(queryKey, 0, subPages, totalCards, pageSelectIdPrefix);

        const deleteButton = new ButtonBuilder()
            .setCustomId(`delete-button-${message.id}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel('Delete')

        const cardActions = [
            new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(cardSelect),
            (subPages !== -1 ?  new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(pageSelect) : undefined),
            new ActionRowBuilder<ButtonBuilder>().addComponents(deleteButton)
        ].filter(val => val);

        return {
            cardEmbeds: [cardEmbed],
            cardActions: cardActions,
            cards: cardList.data.slice(0, limit > cardList.data.length ? cardList.data.length : limit)
        };
    }

    const getCardImageOrFaces = (card: Card): string[] => {
        if(card.image_status === "missing") return [missingImageUrl];

        if(card.card_faces && card.card_faces.length >=1) {
            if(card.card_faces[0]?.image_uris?.large || card.card_faces[1]?.image_uris?.large){
                return card.card_faces.map((face)=>face?.image_uris?.large ?? missingImageUrl);
            }
        }
        return [card?.image_uris?.large ?? missingImageUrl];
    }

    const createCardDetailEmbed = (card: Card): EmbedBuilder => {
        const description = `### [${card.name.replace(/\/\//, faceDelimiter)}](${card.scryfall_uri}) ${getCardManaCost(card, config.getManaEmoji())}\n\n${card.type_line.replace(/\/\//, faceDelimiter)}\n${getCardOracleText(card, config.getManaEmoji())}\n\n${getCardStats(card)}`
        return new EmbedBuilder()
            .setColor(config.botColor)
            .setDescription(description)
            .setThumbnail(getCardImageOrFaces(card)[0])
    }

    const handleCardSelection = async (interaction: StringSelectMenuInteraction) => {

        const cardSelectDataRegex = /.*?:([^:]*?):(\d+):(\d+)/gmi;
        const [, queryKey, subPage, totalCards] = cardSelectDataRegex.exec(interaction.customId);
        const {cards} = await getDataForSubPage( Number(subPage), queryKey, Number(totalCards));
        const selectedCards = interaction.values
            .map((val) => {
                return cards[Number(val)];
            });
        // I can't believe I have to do this
        const leftCaret = '<';
        const rightCaret = '>';
        if (imageOnly) {
            if(selectedCards.length === 1){
                await message.reply({content: `### [${selectedCards[0].name.replace(/\/\//, faceDelimiter)}](${leftCaret}${selectedCards[0].scryfall_uri}${rightCaret})`, files: getCardImageOrFaces(selectedCards[0])});
            }else{
                const attachments = selectedCards
                    .map((card) => ({attachment: getCardImageOrFaces(card)[0]}));
                await message.reply({files: attachments});
            }
        } else {
            await message.reply({embeds: selectedCards.map(createCardDetailEmbed)});
        }
    }

    const handlePageSelection = async (interaction: StringSelectMenuInteraction) => {
        const pageSelectDataRegex = /.*?:([^:]*?):(\d+)/gmi;
        const pageSelectData = pageSelectDataRegex.exec(interaction.customId);
        const queryKey = pageSelectData[1];
        const totalCards = Number(pageSelectData[2]);
        const subPage = isNaN(Number(interaction.values[0])) ? 0 : Number(interaction.values[0]);
        const response = await getDataForSubPage(subPage, queryKey, totalCards);
        const embed = new EmbedBuilder(interaction.message.embeds[0]);
        embed.setFields(createCardFields(response.cards, config.getManaEmoji()));
        embed.setFooter({text: createPageText(subPage+1, response.subPages)})
        const options = createCardSelectOptions(response.cards).map((option, index)=>{
            return new StringSelectMenuOptionBuilder()
                .setLabel(option.label)
                .setDescription(option.description)
                .setValue(`${index}`)
        });

        const cardSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder()
            .setCustomId(`${cardSelectIdPrefix}:${queryKey}:${subPage}:${totalCards}:${Math.floor(Math.random()*99999)}`)
            .setMinValues(1)
            .setMaxValues(response.cards.length<=9 ? response.cards.length: 9)
            .setPlaceholder('Select Card to get details')
            .addOptions(options));

        const pageSelect = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(
            createPageSelect(queryKey, subPage, response.subPages, totalCards, pageSelectIdPrefix));

        const deleteButton = interaction.message.components[2];

        interaction.message.edit({embeds: [embed], components: [cardSelect, pageSelect, deleteButton], content: interaction.message.content})
        interaction.deferUpdate();
    }

    const waitingMessage = await message.reply('Looking...');
    try{
        if(queryOption === config.linkOption){
            const params = new URLSearchParams();
            params.append('q', query);
            params.append('as', 'grid');
            if(privateSelect){
                message.author.send(`Scryfall Search Page:\n${config.scryfallSearchPageUrl}?${params.toString()}`)
                message.reply('Delivered personally!')
            }else {
                message.reply(`Scryfall Search Page:\n${config.scryfallSearchPageUrl}?${params.toString()}`)
            }
            return;
        }

        const cardList = await getDataForFirstPage(encodeURIComponent(query));

        if(cardList.data.length === 1){
            const card = cardList.data[0];
            if(imageOnly){
                message.reply({content: `### [${card.name.replace(/\/\//, faceDelimiter)}](<${card.scryfall_uri}>)`, files: getCardImageOrFaces(card)});
            }else {
                message.reply({embeds: [createCardDetailEmbed(card)]});
            }
            return;
        }

        const {cardEmbeds, cardActions } = processSearchResponse(cardList, encodeURIComponent(query));
        embeds = cardEmbeds;
        components = cardActions

        const reply = privateSelect ? await message.author.send({embeds, components}) : await message.reply({ embeds, components});
        const selectCollector = reply.createMessageComponentCollector({
            componentType: ComponentType.StringSelect,
            filter: (i) => i.user.id === message.author.id,
            time: config.selectTimeOut,
            dispose: true
        });
        const buttonCollector = reply.createMessageComponentCollector({
            componentType: ComponentType.Button,
            filter: (i) => i.user.id === message.author.id || (i.member.permissions as Readonly<PermissionsBitField>).has(PermissionsBitField.Flags.ManageMessages)
        })
        let selectTimeout = startTimeOut(reply);
        selectCollector.on('collect', async (interaction)=> {
            if(interaction.customId.startsWith(cardSelectIdPrefix)){
                await handleCardSelection(interaction);
                clearTimeout(selectTimeout);
                interaction.message.delete();
            } if(interaction.customId.startsWith(pageSelectIdPrefix)){
                await handlePageSelection(interaction);
                clearTimeout(selectTimeout);
                selectTimeout = startTimeOutInteraction(interaction);
            }
        });
        buttonCollector.on('collect', async (interaction) => {
            if(interaction.customId === `delete-button-${message.id}`){
                interaction.message.delete();
            }
        })

    }catch(error){
        const faeFrog = config.emotes.find((emote)=>emote?.name === "FaeFrog");
        if(error.status === 404){
            message.reply(`<:${faeFrog?.name}:${faeFrog?.id}>\nYour query didn’t match any cards. Adjust your search terms or refer to the syntax guide at <https://scryfall.com/docs/reference>`);
        }else{
            console.log("Error during message received\n", error, '\nMessage:\n', message);
            message.reply(`${faeFrog ? `<:${faeFrog?.name}:${faeFrog?.id}>` : ''}\nThere was an error in processing your request: "${error?.response?.data?.details ?? error?.message}"`);
        }
    }finally{
        waitingMessage.delete();
    }
}
