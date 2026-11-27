import {useEffect,useState} from 'react'
import {useAuth} from './auth'
import {supabase} from './supabase'
import {checkAdmin} from '../data/admin'
export function useAdmin() {
  const {session,ready}=useAuth()
  const uid=session?.user?.id
  const [state,setState]=useState({uid:null,allowed:false,loading:true})
  useEffect(()=>{
    let live=true
    if(!ready)return
    if(!uid||!supabase){setState({uid,allowed:false,loading:false});return}
    setState({uid,allowed:false,loading:true})
    checkAdmin().then(allowed=>{if(live)setState({uid,allowed:allowed===true,loading:false})})
      .catch(()=>{if(live)setState({uid,allowed:false,loading:false,error:true})})
    return()=>{live=false}
  },[uid,ready])
  return state.uid===uid?state:{allowed:false,loading:!!uid||!ready}
}
