import { GuildEmoji } from "discord.js";
import { Card } from "scryfall-api";

const getCardStats = (card: Card): string => {
    let stats = '';
    if(card.power && card.toughness){
        stats = `${card.power === '*' ? '\\*' : card.power}/${card.toughness === '*' ? '\\*' : card.toughness}`
    }
    return stats;
}

const getCardManaCost = (card: Card, manaEmotes: GuildEmoji[]): string => {
    const noCost = card.mana_cost === undefined || card.mana_cost === '';
    if(noCost){
        return 'No Cost';
    }
    const manaSymbolRegex = /{(.*?)}/gi
    const costSymbols = card.mana_cost.matchAll(manaSymbolRegex);
    let emoteCost = '';
    for (const costSymbol of costSymbols) {
        const emoteName =  `mana_${costSymbol[1].replace('/', '').toLowerCase()}`;
        const emote = manaEmotes.find((val)=> val.name === emoteName);
        emoteCost = (`${emoteCost}<:${emote.name}:${emote.id}>`) 
    }
    return emoteCost;
}

export { getCardManaCost, getCardStats }