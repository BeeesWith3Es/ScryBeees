import { AttachmentBuilder  } from "discord.js";
import { Card } from "scryfall-api";

const manaSymbolRegex = /{(.*?)}/gi

export const noCostString = 'No Cost';
export const faceDelimiter = '//';

interface Face {
    power?: string,
    toughness?: string,
    mana_cost?: string,
    oracle_text?: string,
    card_faces?: Face[]
}

const formatCardStats = (card: Card | Face, escapeStar = true) => {
    if(card.power && card.toughness){
        return `${card.power === '*' && escapeStar ? '\\*' : card.power}/${card.toughness === '*' && escapeStar ? '\\*' : card.toughness}`
    }
    return '';
}

export const getCardStats = (card: Card, escapeStar = true): string => {
    let stats = '';
    const hasBackfaceStats = (face: Face): boolean => {
        return (!!face.power && !!face.toughness);
    };
    if(card.card_faces && card.card_faces.length>=1){
        card.card_faces.forEach((face, i) => {stats = `${stats} ${i > 0 && hasBackfaceStats(face) ? faceDelimiter : ''} ${formatCardStats(face, escapeStar)}`})
        return stats;
    }
    return formatCardStats(card, escapeStar);
}

export const hasNoCost = (card: Card | Face ): boolean => {
    return card.mana_cost === undefined || card.mana_cost === '';
}

const formatManaCost = (card: Card | Face, manaEmotes: Record<string, string>, blankNoCost = false): string => {
    if(hasNoCost(card)){
        return blankNoCost ? '' : noCostString;
    }

    return insertManaSymbols(card.mana_cost, manaEmotes)
}

export const getCardManaCost = (card: Card, manaEmotes: Record<string, string>): string => {
    let cost = '';
    if(card.card_faces && card.card_faces.length>=1){
        card.card_faces.forEach((face, i)=> {
            if(!hasNoCost(face)){
                cost = `${cost} ${i > 0 ? faceDelimiter : ''} ${formatManaCost(face, manaEmotes, card.type_line.toLowerCase().includes('land'))}`;
            }
        })
        return cost;
    }
    return formatManaCost(card, manaEmotes, card.type_line.toLowerCase().includes('land'));
}

export const getCardOracleText = (card: Card | Face, manaEmotes: Record<string, string>) => {
    let oText = '';

    if(card?.card_faces && card?.card_faces.length>=1){
        card?.card_faces.forEach((face: Face, i: number)=> {oText = `${oText} ${i > 0 ? `\n------------\n` : ''} ${insertManaSymbols(face.oracle_text, manaEmotes)}`})
        return oText;
    }
    return insertManaSymbols(card.oracle_text, manaEmotes);
}

export const insertManaSymbols = (manaText: string, manaEmotes: Record<string, string>) => {

    return manaText.replace(manaSymbolRegex, (originalText, manaSymbol) => {
        const emoteName = `mana_${manaSymbol.toLowerCase().replace('/', '')}`;
        const emoteId = manaEmotes[emoteName];
        if(emoteId){
            return `<:${emoteName}:${emoteId}>`
        }

        return originalText;
    })
}

const scryfallIconB64 = 'data:image/png;base64,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'

const scryfallIconBuffer = Buffer.from(scryfallIconB64.split(",")[1], "base64");
export const scryfallIcon = new AttachmentBuilder(scryfallIconBuffer);