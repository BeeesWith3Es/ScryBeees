import {Card} from "scryfall-api";
import {faceDelimiter, getCardManaCost, getCardStats} from "./card-helpers.js";
import {APIEmbedField, StringSelectMenuBuilder, StringSelectMenuOptionBuilder} from "discord.js";

export const createOption = (label: string, description: string, value: string, emoji?: string) => {
    return {
        label,
        description,
        value,
        emoji
    }
}

const createCardOption = (card: Card, i: number) => {
    return createOption(`${card.name.replace(/\/\//, faceDelimiter)} | ${card.set.toUpperCase()}`, `${card.type_line.replace(/\/\//, faceDelimiter)} ${getCardStats(card, false)}`, `${i}`)
}

const createCardField = (card: Card, manaEmotes: Record<string, string>): APIEmbedField => {

    return {name: ` `, value: `**[${card.name.replace(/\/\//, faceDelimiter)}](${card.scryfall_uri})** | [${card.set.toUpperCase()}](${card.scryfall_set_uri})\n${getCardManaCost(card, manaEmotes)}\n${card.type_line.replace(/\/\//, faceDelimiter)}\n${getCardStats(card)}`, inline: true}
}

export const createCardSelectOptions = (cards: Card[]) =>{
    return cards.map((card, index) => createCardOption(card, index));
}

export const createCardFields = (cards: Card[], manaEmotes: Record<string, string>): APIEmbedField[] => {
    return cards.map((card)=>createCardField(card, manaEmotes));
}

export const createPageSelect = (queryId: string, currentSubPage: number, subPages: number, totalCards: number, pageSelectIdPrefix: string) =>{
    const pageSelect = new StringSelectMenuBuilder()
    if(subPages !== -1){
        pageSelect
            .setCustomId(`${pageSelectIdPrefix}:${queryId}:${totalCards}:${Math.floor(Math.random()*99999)}`)
            .setMinValues(1)
            .setMaxValues(1)
            .setPlaceholder('Select page to jump to');
        for(let i = 0; i < (subPages > 25 ? 25 : subPages); i++){
            let pageNum = i;
            // miserable
            if (subPages > 25){
                if(i<5){
                    pageNum = i;
                } else if (i>19) {
                    pageNum = subPages - (25 - i);
                } else {
                    const rightBound = subPages - 6;
                    const rightMostPage = currentSubPage + 7;
                    const leftBound = 5;
                    const leftMostPage = currentSubPage - 7;

                    let offset = 0;
                    if(rightMostPage > rightBound){
                        offset = rightMostPage - rightBound;
                    } else if (leftMostPage < leftBound) {
                        offset = leftMostPage - leftBound;
                    }
                    pageNum = currentSubPage-((7+offset)-(i-5));
                }
            }

            pageSelect.addOptions(
                new StringSelectMenuOptionBuilder()
                    .setLabel(`Page ${pageNum+1}`)
                    .setValue(`${pageNum}`)
            )
        }
    }
    return pageSelect;
}



export const createPageText = (subPage: number, totalSubPages: number) => {
    return `Page ${subPage} of ${totalSubPages}`;
}