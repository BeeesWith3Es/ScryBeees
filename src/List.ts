import { Card, CardIdentifierBuilder } from "scryfall-api"

interface List {
    object: 'list'
    has_more: boolean
    next_page?: string
    total_cards?: number
    warnings?: string[]
}

interface CardList extends List {
    data: Card[]
}

const getCardNames = (data: CardList | Card, limit: number) => {
    if(data.object === 'list'){
        return data.data.slice(0, limit).map((card)=>card.name);
    } else if(data.object === 'card'){
        return [data.name];
    }
    return [];
}

export { List, CardList, getCardNames};