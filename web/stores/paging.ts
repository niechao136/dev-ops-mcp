import { create } from 'zustand';
import { devtools } from 'zustand/middleware';


type PagingKey = string;


interface PagingItem {
  page: number;
  size: number;
  order_by: string
  direction: 'asc' | 'desc' | ''
  keyword: string
}


interface PagingStore {
  paging: Record<PagingKey, PagingItem>;
  initPaging: (key: PagingKey) => void;
  getPaging: (key: PagingKey) => PagingItem;
  setPage: (key: PagingKey, page: number) => void;
  setSize: (key: PagingKey, size: number) => void;
  setSort: (key: PagingKey, order_by: string, direction: 'asc' | 'desc' | '') => void;
  setSearch: (key: PagingKey, keyword: string) => void;
}


const initialItem: PagingItem = {
  page: 1,
  size: 10,
  order_by: '',
  direction: '',
  keyword: '',
};


export const usePagingStore = create<PagingStore>()(
  devtools((setState, getState) => ({
    paging: {},
    initPaging: (key: PagingKey) => {
      const { paging } = getState();
      if (!paging[key]) {
        setState((state) => ({
          paging: {
            ...state.paging,
            [key]: { ...initialItem }
          }
        }));
      }
    },
    getPaging: (key) => {
      const { paging } = getState();
      return paging[key] ?? initialItem;
    },
    setPage: (key, page) => {
      setState((state) => ({
        paging: {
          ...state.paging,
          [key]: {
            ...(state.paging[key] ?? initialItem),
            page,
          },
        },
      }));
    },
    setSize: (key, size) => {
      setState((state) => ({
        paging: {
          ...state.paging,
          [key]: {
            ...(state.paging[key] ?? initialItem),
            size,
            page: 1,
          },
        },
      }));
    },
    setSort: (key, order_by, direction) => {
      setState((state) => ({
        paging: {
          ...state.paging,
          [key]: {
            ...(state.paging[key] ?? initialItem),
            order_by: !!direction ? order_by : '',
            direction,
          },
        },
      }));
    },
    setSearch: (key, keyword) => {
      setState((state) => ({
        paging: {
          ...state.paging,
          [key]: {
            ...(state.paging[key] ?? initialItem),
            keyword,
          },
        },
      }));
    },
  }))
);
