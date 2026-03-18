import type { UpgradeTemplate, StadiumTier } from './types'

export const TEAM_DEFS = [
  {id:0,name:"Portmere Wanderers",stadiumName:"Wanderers Park",stands:[{name:"Portmere End",type:"Home End" as const,cap:7200,tp:38},{name:"Riverview Terrace",type:"Away End" as const,cap:2800,tp:28},{name:"Family Enclosure",type:"Family" as const,cap:5500,tp:32},{name:"Directors Lounge",type:"VIP" as const,cap:1800,tp:95}]},
  {id:1,name:"Rivergate City",stadiumName:"The Riverside",stands:[{name:"City End",type:"Home End" as const,cap:8100,tp:42},{name:"Away Stand",type:"Away End" as const,cap:3100,tp:30},{name:"Lakeview Family Stand",type:"Family" as const,cap:6200,tp:35},{name:"Chairman's Suite",type:"VIP" as const,cap:2100,tp:110}]},
  {id:2,name:"Oldminster",stadiumName:"Minster Ground",stands:[{name:"The Kop",type:"Home End" as const,cap:9000,tp:36},{name:"Visitors End",type:"Away End" as const,cap:3400,tp:26},{name:"Junior Stand",type:"Family" as const,cap:5800,tp:30},{name:"Heritage Box",type:"VIP" as const,cap:1600,tp:85}]},
  {id:3,name:"Niners",stadiumName:"The Nine Stadium",stands:[{name:"Nine End",type:"Home End" as const,cap:6800,tp:40},{name:"Away Terrace",type:"Away End" as const,cap:2600,tp:28},{name:"Family Zone",type:"Family" as const,cap:4900,tp:33},{name:"Executive Level",type:"VIP" as const,cap:1500,tp:100}]},
  {id:4,name:"Eighters",stadiumName:"Eight Park",stands:[{name:"Eighters End",type:"Home End" as const,cap:7500,tp:38},{name:"Opposition Stand",type:"Away End" as const,cap:2900,tp:27},{name:"Community Stand",type:"Family" as const,cap:5600,tp:31},{name:"Boardroom Terrace",type:"VIP" as const,cap:1700,tp:90}]},
  {id:5,name:"Lanxdon",stadiumName:"Lanxdon Arena",stands:[{name:"Lanxdon Curve",type:"Home End" as const,cap:8500,tp:44},{name:"Away Section",type:"Away End" as const,cap:3300,tp:30},{name:"Families First Stand",type:"Family" as const,cap:6800,tp:36},{name:"Skybox Lounge",type:"VIP" as const,cap:2400,tp:120}]},
  {id:6,name:"Bluewitch",stadiumName:"The Cauldron",stands:[{name:"Witch's End",type:"Home End" as const,cap:7900,tp:41},{name:"Guest Stand",type:"Away End" as const,cap:3000,tp:28},{name:"Youth Wing",type:"Family" as const,cap:5200,tp:32},{name:"Blue Suite",type:"VIP" as const,cap:1900,tp:105}]},
  {id:7,name:"Oakridge United",stadiumName:"United Ground",stands:[{name:"United Terrace",type:"Home End" as const,cap:8800,tp:40},{name:"Visitors Pen",type:"Away End" as const,cap:3200,tp:27},{name:"Oak Family Stand",type:"Family" as const,cap:6500,tp:33},{name:"Prestige Box",type:"VIP" as const,cap:2200,tp:115}]},
  {id:8,name:"Foxborough",stadiumName:"Fox Den",stands:[{name:"Fox Corner",type:"Home End" as const,cap:6500,tp:37},{name:"Away Cage",type:"Away End" as const,cap:2500,tp:26},{name:"Den Family Section",type:"Family" as const,cap:4600,tp:30},{name:"Directors End",type:"VIP" as const,cap:1400,tp:88}]},
  {id:9,name:"Norbridge Town",stadiumName:"Norbridge Bowl",stands:[{name:"Town End",type:"Home End" as const,cap:7100,tp:39},{name:"Visitor Terrace",type:"Away End" as const,cap:2700,tp:28},{name:"Community End",type:"Family" as const,cap:5300,tp:32},{name:"Corporate Lounge",type:"VIP" as const,cap:1600,tp:95}]},
  {id:10,name:"Oakridge",stadiumName:"The Oak",stands:[{name:"Oakridge Bank",type:"Home End" as const,cap:7600,tp:38},{name:"Away Paddock",type:"Away End" as const,cap:2900,tp:27},{name:"Family Terrace",type:"Family" as const,cap:5700,tp:31},{name:"Founders Suite",type:"VIP" as const,cap:1800,tp:98}]},
  {id:11,name:"Eversley",stadiumName:"Eversley Park",stands:[{name:"Eversley End",type:"Home End" as const,cap:8300,tp:43},{name:"Away Wing",type:"Away End" as const,cap:3100,tp:29},{name:"Junior Block",type:"Family" as const,cap:6100,tp:34},{name:"Platinum Box",type:"VIP" as const,cap:2000,tp:108}]},
]

export const UPG: Record<string, UpgradeTemplate[]> = {
  "Home End": [
    {id:"safe_standing",name:"Safe standing",cost:250000,effect:"atmosphere",val:12,desc:"+12% atm"},
    {id:"big_screen",name:"Big screen",cost:180000,effect:"atmosphere",val:8,desc:"+8% atm"},
    {id:"ultras_section",name:"Ultras section",cost:80000,effect:"atmosphere",val:15,desc:"+15% atm"},
    {id:"covered_roof",name:"Covered roof",cost:400000,effect:"occupancy",val:8,desc:"+8% occ"},
    {id:"singing_section",name:"Singing section",cost:50000,effect:"atmosphere",val:10,desc:"+10% atm"},
  ],
  "Away End": [
    {id:"away_roof",name:"Covered section",cost:200000,effect:"occupancy",val:6,desc:"+6% occ"},
    {id:"away_screen",name:"Away screen",cost:100000,effect:"atmosphere",val:5,desc:"+5% atm"},
    {id:"away_catering",name:"Dedicated catering",cost:120000,effect:"revenue",val:8,desc:"+8% concessions"},
  ],
  "Family": [
    {id:"play_area",name:"Play area",cost:150000,effect:"occupancy",val:10,desc:"+10% occ"},
    {id:"family_catering",name:"Meal deals",cost:90000,effect:"revenue",val:6,desc:"+6% concessions"},
    {id:"sensory_room",name:"Sensory room",cost:120000,effect:"mood",val:5,desc:"+5% mood"},
    {id:"viewing_ramp",name:"Accessible ramp",cost:200000,effect:"occupancy",val:7,desc:"+7% occ"},
  ],
  "VIP": [
    {id:"padded_seats",name:"Premium seats",cost:300000,effect:"revenue",val:15,desc:"+15% VIP rev"},
    {id:"hospitality",name:"Full hospitality",cost:500000,effect:"revenue",val:25,desc:"+25% VIP rev"},
    {id:"private_bar",name:"Private bar",cost:200000,effect:"revenue",val:12,desc:"+12% VIP rev"},
    {id:"tunnel_access",name:"Tunnel access",cost:350000,effect:"mood",val:8,desc:"+8% mood"},
  ],
}

export const TIERS: StadiumTier[] = [
  {id:"community",name:"Community Stadium",capacity:25000,cm:0.8,desc:"Modern 25,000-seat ground.",stands:[{name:"North Stand",type:"Home End",cap:9000,tp:42,occ:0.82,atm:68},{name:"South Stand",type:"Away End",cap:4000,tp:32,occ:0.75,atm:60},{name:"East Family Stand",type:"Family",cap:8000,tp:36,occ:0.78,atm:62},{name:"West Paddock",type:"VIP",cap:4000,tp:110,occ:0.88,atm:55}],features:["Modern concourses","LED floodlights","Accessible facilities","Club shop"]},
  {id:"elite",name:"Elite Arena",capacity:38000,cm:1.2,desc:"38,000-seat elite arena.",stands:[{name:"North Terrace",type:"Home End",cap:14000,tp:48,occ:0.85,atm:78},{name:"South End",type:"Away End",cap:5500,tp:36,occ:0.8,atm:70},{name:"Family Quarter",type:"Family",cap:11000,tp:40,occ:0.82,atm:72},{name:"Premium Lounge",type:"VIP",cap:7500,tp:135,occ:0.92,atm:65}],features:["Retractable roof","Wi-Fi","Luxury hospitality","Megastore"]},
  {id:"iconic",name:"Iconic Fortress",capacity:55000,cm:1.8,desc:"World-class 55,000-capacity fortress.",stands:[{name:"The Cathedral End",type:"Home End",cap:22000,tp:55,occ:0.9,atm:92},{name:"Away Sector",type:"Away End",cap:7000,tp:40,occ:0.85,atm:80},{name:"Family Pavilion",type:"Family",cap:14000,tp:45,occ:0.86,atm:82},{name:"Platinum Terrace",type:"VIP",cap:12000,tp:160,occ:0.95,atm:75}],features:["Retractable roof","Heated pitch","360° LED ribbon","Fan tunnel","Rooftop bar","Conference centre"]},
]

export const TSENS: Record<string, { t: number }> = {
  "Home End": {t:5},
  "Away End": {t:3},
  "Family": {t:4},
  "VIP": {t:15},
}

export const TV = 100e6
export const SOL = 1.5e6
export const PB = 2e6
export const PS = 2.5e6
export const SC = 3200
export const NFX = 6
