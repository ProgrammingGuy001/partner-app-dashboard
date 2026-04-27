/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useReducer } from 'react';
import type { BucketItem, SOLookupDetails } from '@/api/bom';

interface RequisiteState {
    salesOrder: string;
    cabinetPosition: string;
    soDetails: SOLookupDetails | null;
    bucket: BucketItem[];
}

type Action =
    | { type: 'SET_SO'; salesOrder: string; cabinetPosition: string; soDetails: SOLookupDetails | null }
    | { type: 'SET_SO_DETAILS'; soDetails: SOLookupDetails | null }
    | { type: 'ADD_ITEM'; item: BucketItem }
    | { type: 'REMOVE_ITEM'; productName: string }
    | { type: 'UPDATE_ITEM'; productName: string; updates: Partial<BucketItem> }
    | { type: 'CLEAR' };

const initialState: RequisiteState = {
    salesOrder: '',
    cabinetPosition: '',
    soDetails: null,
    bucket: [],
};

function reducer(state: RequisiteState, action: Action): RequisiteState {
    switch (action.type) {
        case 'SET_SO':
            return {
                ...state,
                salesOrder: action.salesOrder,
                cabinetPosition: action.cabinetPosition,
                soDetails: action.soDetails,
            };
        case 'SET_SO_DETAILS':
            return { ...state, soDetails: action.soDetails };
        case 'ADD_ITEM':
            return { ...state, bucket: [...state.bucket, action.item] };
        case 'REMOVE_ITEM':
            return { ...state, bucket: state.bucket.filter(i => i.product_name !== action.productName) };
        case 'UPDATE_ITEM':
            return {
                ...state,
                bucket: state.bucket.map(i =>
                    i.product_name === action.productName ? { ...i, ...action.updates } : i
                ),
            };
        case 'CLEAR':
            return initialState;
        default:
            return state;
    }
}

interface RequisiteContextValue {
    state: RequisiteState;
    setSO: (salesOrder: string, cabinetPosition: string, soDetails?: SOLookupDetails | null) => void;
    setSODetails: (soDetails: SOLookupDetails | null) => void;
    addItem: (item: BucketItem) => void;
    removeItem: (productName: string) => void;
    updateItem: (productName: string, updates: Partial<BucketItem>) => void;
    clear: () => void;
}

const RequisiteContext = createContext<RequisiteContextValue | null>(null);

export function RequisiteProvider({ children }: { children: React.ReactNode }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    const value: RequisiteContextValue = {
        state,
        setSO: (salesOrder, cabinetPosition, soDetails = null) =>
            dispatch({ type: 'SET_SO', salesOrder, cabinetPosition, soDetails }),
        setSODetails: (soDetails) => dispatch({ type: 'SET_SO_DETAILS', soDetails }),
        addItem: (item) => dispatch({ type: 'ADD_ITEM', item }),
        removeItem: (productName) => dispatch({ type: 'REMOVE_ITEM', productName }),
        updateItem: (productName, updates) => dispatch({ type: 'UPDATE_ITEM', productName, updates }),
        clear: () => dispatch({ type: 'CLEAR' }),
    };

    return <RequisiteContext.Provider value={value}>{children}</RequisiteContext.Provider>;
}

export function useRequisite() {
    const ctx = useContext(RequisiteContext);
    if (!ctx) throw new Error('useRequisite must be used within RequisiteProvider');
    return ctx;
}
