import {CardList} from "./List.js";
import {Card} from "scryfall-api";
import axios, {AxiosResponse} from "axios";


interface IndexMetaData {
    page: number
    startingIndex: number
    endingIndex: number
}

const pageRegex = /&page=(\d+)/;

export const usePagination = (url: string) => {
    const itemsPerPage = 175;
    const itemsPerSubPage = 9;
    // const lastWholeSubpage = Math.floor(firstPageData.total_cards/itemsPerPage);
    // const lastSubPageCrossesSeam = itemsOnLastPage !== itemsPerSubPage;

    const pageCache: Record<string, Record<string, CardList>> = {};

    const clearPageCache = () => {
        for (let key in pageCache){
            if (pageCache.hasOwnProperty(key)){
                delete pageCache[key];
            }
        }
    };

    const prettyPrintCache = (): string => {
        let print = ''
        Object.entries(pageCache).forEach((query)=>{
            print = `${print}Query: ${query[0]}\nTotal Cards: ${query[1]['0'].total_cards}\n`
            Object.entries(query[1]).forEach((page)=> {
                print = `${print}\t${page[0]}: First Card: ${page[1].data[0].name}\n\t   Page Size: ${page[1].data.length}\n`
            })
        })
        return print;
    }

    // used externally
    const getNumberOfSubPages = (queryKey: string) => {
        const totalCards = Number(pageCache?.[queryKey]?.['0'].total_cards);
        if(isNaN(totalCards)) return -1;
        return Math.ceil(totalCards/itemsPerSubPage);
    }

    const firstCardNumber = (subPage: number, totalCards: number): number => {
        return Math.min((subPage * itemsPerSubPage), totalCards-1);
    }

    const lastCardNumber = (subPage: number, totalCards: number): number => {
        return Math.min((firstCardNumber(subPage, totalCards)+itemsPerSubPage-1), totalCards);
    }

    const getPageNumber = (cardNumber: number): number => {
        return Math.floor(cardNumber/itemsPerPage);
    }

    const crossesSeam = (subPage: number, totalCards: number):boolean => {
        return getPageNumber(firstCardNumber(subPage, totalCards)) != getPageNumber(lastCardNumber(subPage, totalCards));
    }

    const getStartingIndex = (subPage: number, totalCards: number): number => {
        return firstCardNumber(subPage, totalCards) % itemsPerPage;
    }

    const getEndingIndex = (subPage: number, totalCards: number): number => {
        return lastCardNumber(subPage, totalCards) % itemsPerPage;
    }

    const getIndexMetaData = (subPage: number, totalCards: number): IndexMetaData[] => {
        const indexMetaData = <IndexMetaData[]>[];
        const page = getPageNumber(firstCardNumber(subPage, totalCards));
        if(crossesSeam(subPage, totalCards)){
            const leftSeam = {
                page: page,
                startingIndex: getStartingIndex(subPage, totalCards),
                endingIndex: itemsPerPage-1
            }

            indexMetaData.push(leftSeam);
            indexMetaData.push({
                page: page+1,
                startingIndex: 0,
                endingIndex: itemsPerSubPage - 1 - (leftSeam.endingIndex - leftSeam.startingIndex) - 1
            });
        } else {
            indexMetaData.push({
                page: page,
                startingIndex: getStartingIndex(subPage, totalCards),
                endingIndex: getEndingIndex(subPage, totalCards)
            });
        }

        return indexMetaData;
    }

    const getDataPageNumber = (pageUrl: string): number | null => {
        const regexCapture = pageRegex.exec(pageUrl);
        if(regexCapture != null && !isNaN(Number(regexCapture[1]))){
            // Sub 2 because it's 1 indexed *next* page, and we want 0 indexed *current* page
            return Number(regexCapture[1])-2;
        }
        return null;
    }

    const getDataQuery = (pageUrl: string) => {
        const regexCapture = /[?&]q=([^&]*)&??/gmi.exec(pageUrl);
        return regexCapture?.[1] ?? null;
    }

    const getDataForPage = async (queryKey: string, page: number) => {
        const query = decodeURIComponent(queryKey);
        if(!pageCache[queryKey]){
            pageCache[queryKey] = {};
        }
        if(!pageCache[queryKey][page]){
            console.log(`Fetching data for page ${page} query "${query}" ... `)
            const response: AxiosResponse<CardList, any> = await axios.get(url, {params: {q: query, page: page > 0 ? page+1 : undefined}});
            pageCache[queryKey][page] = response.data;
        } else {
            console.log(`Using cache for page ${page} query "${query}".`)
        }
        return pageCache[queryKey][page];
    }

    const getDataForFirstPage = async (queryKey: string) => {
        return await getDataForPage(queryKey, 0);
    }

    const getDataForSubPage = async (subPage: number, queryKey: string, totalCards: number): Promise<{cards: Card[], cardIndexes: number[], query: string, subPages: number}> => {
        // const dataPage = getDataPageNumber(subPage);
        const indexMetaData = getIndexMetaData(subPage, totalCards);
        if(!pageCache[queryKey]){
            pageCache[queryKey] = {};
        }
        for (let i = 0; i < indexMetaData.length; i++) {
            const pageNumber = indexMetaData[i].page;
            if(!pageCache[queryKey][pageNumber]){
                try {
                    pageCache[queryKey][pageNumber] = await getDataForPage(queryKey, pageNumber);
                } catch (error) {
                    console.log(`Error while fetching pages for pagination: `, error);
                }
            } else {
                console.log(`Using cached data for page ${pageNumber} "${decodeURIComponent(queryKey)}".`)
            }

        }

        let cards: Card[] = [];
        let cardIndexes: number[] = [];
        // const pages: number[] = [];
        indexMetaData.forEach((metaData) => {
            // pages.push(metaData.page);
            cards = cards.concat(pageCache[queryKey][metaData.page].data.slice(metaData.startingIndex, metaData.endingIndex+1))
            cardIndexes = cardIndexes.concat([...Array(metaData.endingIndex - metaData.startingIndex + 1).keys()].map(x => x + metaData.startingIndex));
        })

        const subPages = Math.ceil(totalCards/itemsPerSubPage);

        return {cards, cardIndexes, query: queryKey, subPages};
    }

    return { getDataForFirstPage, getDataForPage,  getDataForSubPage, getNumberOfSubPages, pageCache, clearPageCache, prettyPrintCache };
}