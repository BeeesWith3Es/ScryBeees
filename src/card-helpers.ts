import { GuildEmoji } from "discord.js";
import { Card } from "scryfall-api";

const manaSymbolRegex = /{(.*?)}/gi

export const noCostString = 'No Cost';
export const faceDelimiter = '//';

const formatCardStats = (card: Card | {power?: string, toughness?: string}, escapeStar = true) => {
    if(card.power && card.toughness){
        return `${card.power === '*' && escapeStar ? '\\*' : card.power}/${card.toughness === '*' && escapeStar ? '\\*' : card.toughness}`
    }
    return '';
}

export const getCardStats = (card: Card, escapeStar = true): string => {
    let stats = '';
    if(card.card_faces && card.card_faces.length>=1){
        card.card_faces.forEach((face, i)=> {stats = `${stats} ${i > 0 ? faceDelimiter : ''} ${formatCardStats(face, escapeStar)}`})
        return stats;
    }
    return formatCardStats(card, escapeStar);
}

export const hasNoCost = (card: Card | {mana_cost?: string}): boolean => {
    return card.mana_cost === undefined || card.mana_cost === '';
}

const formatManaCost = (card: Card | {mana_cost?: string}, manaEmotes: Record<string, string>, blankNoCost = false): string => {
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
                cost = `${cost} ${i > 0 ? faceDelimiter : ''} ${formatManaCost(face, manaEmotes)}`;
            }
        })
        return cost;
    }
    return formatManaCost(card, manaEmotes);
}

export const getCardOracleText = (card: Card | {oracle_text?: string, card_faces?: []}, manaEmotes: Record<string, string>) => {
    let oText = '';

    if(card.card_faces && card.card_faces.length>=1){
        card.card_faces.forEach((face, i)=> {oText = `${oText} ${i > 0 ? `\n------------\n` : ''} ${insertManaSymbols(face.oracle_text, manaEmotes)}`})
        return oText;
    }
    return insertManaSymbols(card.oracle_text, manaEmotes);
}

export const insertManaSymbols = (manaText: string, manaEmotes: Record<string, string>) => {

    return manaText.replace(manaSymbolRegex, (originalText, manaSymbol) => {
        const emoteName = `mana_${manaSymbol.toLowerCase()}`;
        const emoteId = manaEmotes[emoteName];
        if(emoteId){
            return `<:${emoteName}:${emoteId}>`
        }

        return originalText;
    })
}