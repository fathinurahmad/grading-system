import { CreateNewUserData, CreateNewUserVariables, GetUserData, CreateMovieListData, CreateMovieListVariables, ListPublicMovieListsData } from '../';
import { UseDataConnectQueryResult, useDataConnectQueryOptions, UseDataConnectMutationResult, useDataConnectMutationOptions} from '@tanstack-query-firebase/react/data-connect';
import { UseQueryResult, UseMutationResult} from '@tanstack/react-query';
import { DataConnect } from 'firebase/data-connect';
import { FirebaseError } from 'firebase/app';


export function useCreateNewUser(options?: useDataConnectMutationOptions<CreateNewUserData, FirebaseError, CreateNewUserVariables>): UseDataConnectMutationResult<CreateNewUserData, CreateNewUserVariables>;
export function useCreateNewUser(dc: DataConnect, options?: useDataConnectMutationOptions<CreateNewUserData, FirebaseError, CreateNewUserVariables>): UseDataConnectMutationResult<CreateNewUserData, CreateNewUserVariables>;

export function useGetUser(options?: useDataConnectQueryOptions<GetUserData>): UseDataConnectQueryResult<GetUserData, undefined>;
export function useGetUser(dc: DataConnect, options?: useDataConnectQueryOptions<GetUserData>): UseDataConnectQueryResult<GetUserData, undefined>;

export function useCreateMovieList(options?: useDataConnectMutationOptions<CreateMovieListData, FirebaseError, CreateMovieListVariables>): UseDataConnectMutationResult<CreateMovieListData, CreateMovieListVariables>;
export function useCreateMovieList(dc: DataConnect, options?: useDataConnectMutationOptions<CreateMovieListData, FirebaseError, CreateMovieListVariables>): UseDataConnectMutationResult<CreateMovieListData, CreateMovieListVariables>;

export function useListPublicMovieLists(options?: useDataConnectQueryOptions<ListPublicMovieListsData>): UseDataConnectQueryResult<ListPublicMovieListsData, undefined>;
export function useListPublicMovieLists(dc: DataConnect, options?: useDataConnectQueryOptions<ListPublicMovieListsData>): UseDataConnectQueryResult<ListPublicMovieListsData, undefined>;
