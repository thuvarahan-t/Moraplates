import { createBrowserRouter, Navigate } from 'react-router'
import Layout from './Layout'
import Home from './pages/Home'
import Welcome from './pages/Welcome'
import Canteens from './pages/Canteens'
import Canteen from './pages/Canteen'
import AddCanteen from './pages/AddCanteen'
import Top from './pages/Top'
import Profile, { UserProfile } from './pages/Profile'
import PeoplePage from './pages/PeoplePage'
import PostDetail from './pages/PostDetail'
import Admin from './pages/Admin'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'welcome', element: <Welcome /> },
      { path: 'canteens', element: <Canteens /> },
      { path: 'canteens/new', element: <AddCanteen /> },
      { path: 'canteens/:id', element: <Canteen /> },
      { path: 'top', element: <Top /> },
      { path: 'profile', element: <Profile /> },
      { path: 'u/:id', element: <UserProfile /> },
      { path: 'people', element: <PeoplePage /> },
      { path: 'posts/:id', element: <PostDetail /> },
      { path: 'admin', element: <Admin /> },
      // The feed lives on the landing page; keep old /feed links working.
      { path: 'feed', element: <Navigate to="/" replace /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])
