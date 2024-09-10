import {CardList} from "./List.js";
import {Card} from "scryfall-api";
import axios from "axios";


interface IndexMetaData {
    page: number
    startingIndex: number
    endingIndex: number
}

const pageRegex = /&page=(\d+)/;

export const usePagination = () => {
    const itemsPerPage = 175;
    const itemsPerSubPage = 9;
    // const lastWholeSubpage = Math.floor(firstPageData.total_cards/itemsPerPage);
    // const lastSubPageCrossesSeam = itemsOnLastPage !== itemsPerSubPage;

    const pageData: Record<string, Record<string, CardList>> = {};

    const clearPageData = () => {
        for (let key in pageData){
            if (pageData.hasOwnProperty(key)){
                delete pageData[key];
            }
        }
    };

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
            // console.log('No seam', getStartingIndex(subPage, totalCards), ', ', getEndingIndex(subPage, totalCards))
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

    const getDataForSubPage = async (subPage: number, firstPageData: CardList): Promise<{cards: Card[], query: string, pages: number[]}> => {
        // const dataPage = getDataPageNumber(subPage);
        const totalCards = firstPageData.total_cards
        const query = getDataQuery(firstPageData.next_page);
        const indexMetaData = getIndexMetaData(subPage, totalCards);
        if(!pageData[query]){
            pageData[query] = {};
        }
        for (let i = 0; i < indexMetaData.length; i++) {
            const pageNumber = indexMetaData[i].page;
            if(!pageData[query][pageNumber]){
                console.log(`Fetching data for page ${pageNumber} ... `)
                try {
                    const response = await axios.get(firstPageData.next_page.replace(pageRegex, `&page=${pageNumber + 1}`))
                    pageData[query][pageNumber] = response.data;
                } catch (error) {
                    console.log(`Error while fetching pages for pagination: `, error);
                }
            } else {
                console.log(`Using cached data for page ${pageNumber}.`)
            }

        }

        let cards: Card[] = [];
        const pages: number[] = [];
        indexMetaData.forEach((metaData) => {
            pages.push(metaData.page);
            cards = cards.concat(pageData[query][metaData.page].data.slice(metaData.startingIndex, metaData.endingIndex+1))
        })

        return {cards, query, pages};
    }

    return { getDataForSubPage, pageData, clearPageData };
}