# Reddit Data Analysis

*This file contains 5 Reddit posts with their full comment trees, prepared for schema analysis.*

## Data Schema Recommendations

### Recommended Post Schema

```typescript
interface Post {
  id: string;                  // Unique post identifier
  subreddit: string;           // Subreddit name
  title: string;               // Post title
  content: string;             // Post content/body
  author: string;              // Author username
  created_at: Date;            // Creation timestamp
  score: number;               // Post score (upvotes - downvotes)
  upvote_ratio: number;        // Ratio of upvotes to all votes
  url: string;                 // URL of the post
  permalink: string;           // Reddit permalink to the post
  is_self_post: boolean;       // Whether it's a text post or link
  flair?: string;              // Optional post flair
  is_nsfw: boolean;            // Whether the post is marked NSFW
  is_spoiler: boolean;         // Whether the post is marked as spoiler
  comment_count: number;       // Total number of comments
}
```

### Recommended Comment Schema

```typescript
interface Comment {
  id: string;                  // Unique comment identifier
  post_id: string;             // ID of the parent post
  parent_id: string;           // ID of parent comment (or post if top-level)
  author: string;              // Comment author username
  content: string;             // Comment text content
  created_at: Date;            // Creation timestamp
  score: number;               // Comment score (upvotes - downvotes)
  depth: number;               // Nesting level of the comment
  permalink: string;           // Reddit permalink to the comment
  is_stickied: boolean;        // Whether the comment is pinned/stickied
  path: string[];              // Array storing the path of parent IDs
}
```

### Filtering Strategies

1. **Post Filtering**:
   - By subreddit
   - By minimum score
   - By minimum comment count
   - By date range
   - By author
   - By flair

2. **Comment Filtering**:
   - By post ID
   - By parent comment ID
   - By depth (e.g., only top-level comments)
   - By minimum score
   - By author
   - By date
   - By keywords in content

3. **Tree Traversal**:
   - Use the `path` array to efficiently retrieve entire comment threads
   - Query comments by their position in the thread hierarchy
   - Reconstruct threads with efficient database queries

## Example Posts with Comments

### Post 1: What is your favorite part of living in LA?

**Author:** lumpythefrog  
**Subreddit:** r/AskLosAngeles  
**Created:** 3/1/2025, 8:33:44 AM  
**Score:** 194 (93% upvoted)  
**Comments:** 238  
**URL:** [https://www.reddit.com/r/AskLosAngeles/comments/1j0pqrf/what_is_your_favorite_part_of_living_in_la/](https://www.reddit.com/r/AskLosAngeles/comments/1j0pqrf/what_is_your_favorite_part_of_living_in_la/)  

**Content:**

> I live in Pasadena with my wife and am originally from the SFV. I hear people dissing LA all the time, especially as of recent. 
> 
> “Why don’t you just move to a cheaper city if it’s so expensive” type commentary that just feels like it’s missing the point. 
> 
> We need some more positivity. What is something unique about your neighborhood that reminds you of how special living here actually is? 

#### Comments:

- **AutoModerator** (Score: 1) - 3/1/2025, 8:33:45 AM
  > This is an automated message that is applied to every post. Just a general reminder, /r/AskLosAngeles is a friendly question and answer subreddit for the region of Los Angeles, California. Please follow [the subreddit rules](/r/AskLosAngeles/about/rules/), report content that does not follow rules, and feel empowered to contribute to the [subreddit wiki](https://www.reddit.com/r/AskLosAngeles/wiki/) or to ask questions of your fellow community members. The vibe should be helpful and friendly and the quality of your contribution makes a difference. Unhelpful comments are discouraged, rude interactions are bannable.
  > 
  > *I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](/message/compose/?to=/r/AskLosAngeles) if you have any questions or concerns.*

- **PamWhoDeathRemembers** (Score: 228) - 3/1/2025, 8:41:32 AM
  > I rented in the Hollywood Hills for three years and one time, before his passing, I saw David Lynch smoking a cigarette while out on my hike. 
  > 
  > These days especially I fucking cherish that moment.
  > 
  > Edit: since this got a lot of upvotes I feel compelled to tell other LA renters that the historic areas of the Hollywood Hills near the bowl have some pretty affordable rental options that crop up from time to time. Usually you have to rent at the base of a hill instead of the top, but sometimes you can even find mother-in-law houses or above-the-garage units being rented at some of the old mansions. Whitley Heights, The Hollywood Dell, and Outpost Estates are my three favorite hill areas.

  - **Melodic-Project4602** (Score: 31) - 3/1/2025, 12:41:20 PM
    > Worked Amazon and I’d deliver his packages to his house there, also you must be loaded

    - **PamWhoDeathRemembers** (Score: 29) - 3/1/2025, 9:01:46 PM
      > I wish I was loaded, but instead I was fortunate enough to be renting a studio apt in a historic building for kinda cheap. Craigslist, people. Once you learn how to avoid the scams you can find some pretty cool living situations. I can’t believe you delivered his packages !

      - **georgee1979** (Score: 3) - 3/1/2025, 11:43:54 PM
        > How do you like living in Pas vs the SFV? I’ve only lived in the SFV my entire life, but love Pas. My problem is the fear of leaving what I know I think. I’d love your thoughts!

      - **Melodic-Project4602** (Score: 1) - 3/2/2025, 10:50:44 AM
        > Well good shit, you can get lucky. I was really stoked on the guy’s movies in high school, but really it’s just like any other delivery, little Amazon bubble bags but his name was on it lol. I had to google his house to make sure it was the same guy. Would also do Uber eats and I’d deliver 6 packs to Zach hill from death grips

    - **Upnorth4** (Score: 6) - 3/1/2025, 9:33:02 PM
      > I delivered a package to the Beverly Hillbillies mansion once, I had to speak to their security staff to deliver the package

  - **dausone** (Score: 17) - 3/1/2025, 6:15:42 PM
    > Amoeba. This dude on the other side of the rack looking familiar like Popeye. It was Quentin Tarantino.

  - **D-D** (Score: 12) - 3/1/2025, 9:08:17 AM
    > He was so cool. 😎

  - **musubitime** (Score: 28) - 3/1/2025, 10:10:05 AM
    > I’ve had a few low key celeb sightings, but my all time favorite was when I was in line at the DMV and Marion Ross (Happy Days) was right in front of me and we had a lovely chat. I mean of course America’s mom (for a time) would be lovely, but it’s nice to experience it first hand.

    - **Lazerus42** (Score: 5) - 3/2/2025, 1:51:10 AM
      > I was doing one of those 60 min kickboxing/conditioning classes at a small local gym, look over and see Steve Urkel doing a personal conditioning session.  Dude, it took me a second to recognize him.  Jaleel White grew up!

  - **Top_Investment_4599** (Score: 9) - 3/2/2025, 12:37:46 AM
    > Not even living in Hollywood Hills, in the SFV, I see Danny Trejo at brunch with friends, Samuel Jackson visiting CV. Just in the same block and almost the same time. Back in the day, Jack Warden fishing for affirmation, Mike Connors on his studio bike, Paula Abdul driving her beatup Jag XJ-S, all the time saw Michael Jackson down at local Crown Books, too many celebs really.

    - **PamWhoDeathRemembers** (Score: 3) - 3/2/2025, 12:57:22 AM
      > I saw a car on the freeway one time with the vanity plate JONLVTZ but I couldn’t speed up in time to see if Jon Lovitz was driving. I’ve wondered for years. It was not a good car.

  - **Far_Appointment9964** (Score: 5) - 3/1/2025, 11:12:41 AM
    > so coool oml

  - **lalahair** (Score: 3) - 3/2/2025, 3:04:59 AM
    > I saw Halle Barry on the back of some dude on a motorcycle my first day moving in to a house on the top of one of those hills. (Rented a room, I’m also not rich). But honestly it’s not worth it. Seeing celebrities is amusing, but shouldn’t be a favorite part of living in LA. Moving out of this place very soon.

- **armen89** (Score: 115) - 3/1/2025, 9:35:22 AM
  > Leaving. When you leave LA you immediately appreciate the way of life here. Coming back is the best feeling.
  > 
  > Edit: I meant leaving more like going on vacation and returning. I can’t imagine living anywhere else.

  - **ForwardConnection** (Score: 23) - 3/1/2025, 2:38:58 PM
    > Went to london got humbled, this feels like paradise now

    - **Turbulent_Moose_3553** (Score: 6) - 3/1/2025, 5:27:50 PM
      > Could you elaborate a bit about London?

  - **cav63** (Score: 15) - 3/1/2025, 11:06:20 AM
    > same. moved to denver for a couple years and just came home

  - **Aggravating_Lynx2107** (Score: 5) - 3/2/2025, 1:51:34 AM
    > We moved to the IE in June and miss LA everyday tbh. We’re not even extroverts or anything. There’s pros and cons, obviously. But we miss the food options we used to have. Can’t beat the food quality and diversity in LA imo

  - **Ak40x** (Score: 3) - 3/1/2025, 4:27:42 PM
    > I wanna go back. Miss it a lot.

- **Mr-Frog** (Score: 109) - 3/1/2025, 8:44:19 AM
  > I think it's cool how large and culturally significant the middle class Mexican, Black, and Asian neighborhoods are compared to other cities. It's awesome just there are minority kids growing up in nice neighborhoods where they aren't the only ones from their background.

  - **lunchypoo222** (Score: 49) - 3/1/2025, 9:26:28 AM
    > The diversity and cultural heritage of LA is one of my favorite things about it.

  - **lilflor** (Score: 49) - 3/1/2025, 9:20:44 AM
    > Yes! I’m Latina and moved from out of state to what seemed like a really suburban white picket fence street in Mid-City and I was thrilled in our first week to meet our neighbors who are Jamaican, Korean, Mexican and Salvadorean - nurses, teachers, business owners and homeowners - it’s so wonderful to be integrated into such a diverse community.

    - **Silver-Firefighter35** (Score: 15) - 3/1/2025, 12:48:57 PM
      > I’m a mostly white guy from the Midwest. I loved living Mid-City where I was a minority. The people, the food, the culture, so vibrant. When I lived by Fairfax, I was like, six Ethiopian restaurants? And all the great places in Koreatown? Also, great museums, not just the major ones. Camping in the mountains, playing around at the beach. Just walking around downtown. Neighbors are very friendly and welcoming even though it’s a huge city. Great universities. I love Echo Park Lake, I walk around it most days. And I love that my kids were born and raised here.

      - **lawyers_guns_nomoney** (Score: 5) - 3/1/2025, 1:57:15 PM
        > Thank god they revitalized echo park lake (and then did it again). It was a not nice place when I was growing up in the 80s and 90s. But agree, it is lovely now.

        - **Upnorth4** (Score: 8) - 3/1/2025, 9:55:53 PM
          > I wish they would do the same to MacArthur park. I was over there a few days ago and it looked like a zombie wasteland

          - **Silver-Firefighter35** (Score: 3) - 3/2/2025, 2:59:09 AM
            > I was driving by MacArthur Park with an older friend and he said it used to be so beautiful. I asked “like, in the ‘80s?” And he said, “God no, in the ‘40s when I was a kid!”  That said, if you stay off the Alvarado side, there are still enjoyable parts of the park.

    - **Renza183** (Score: 3) - 3/2/2025, 4:53:13 AM
      > Mid-city is great! In addition to the diversity, it takes equally long to drive to most parts of the city 😂 instead of 1-1.5 hours from East to West side

    - **marine_layer2014** (Score: 1) - 3/2/2025, 7:15:18 AM
      > I live near (in?) Mid City and I love it for the same reasons!! It’s such a melting pot of cultures and everyone looks out for each other

  - **californiaskiddo** (Score: 14) - 3/1/2025, 10:47:35 AM
    > I was one of those kids, as a Latina I got to grow up in a super diverse middle class neighborhood and I loved it. The amount of culture awareness and knowledge I have compared to the average American just from growing up here is insane and something I am super grateful for.

  - **Due-Run-5342** (Score: 11) - 3/1/2025, 10:52:20 AM
    > The food scene due to this is amazing

  - **Sea_Of_Energy** (Score: 9) - 3/1/2025, 1:10:09 PM
    > And LA is the many firsts for POC to become educated hold jobs that were segregated before civil rights. UCLA had the first Black engineer and etc. 
    > 
    > It’s a special place and we’re all responsible for keeping it that way ❤️

- **SlowSwords** (Score: 131) - 3/1/2025, 9:29:40 AM
  > If LA works for you, or you can make it work, I don’t know if there’s a better place to live.
  > 
  > Im from SoCal, so I love that my family is here and it’s where I grew up. But just in terms of LA as a place—I love that every band stops here on their tours. That there are more cultural institutions than you could ever hope to visit. Just the other day on a whim we hung out at the hammer museum and caught lunch at Lulu’s. On that note, LA has the best food scene in the country. It’s insane that you can eat the best tacos in the US for lunch from a truck and then have dinner at one of the hottest restaurants in the country. 
  > 
  > I love that the politics are open and inclusive. That I could sit up and say “fuck ICE!” in a restaurant and people would probably say “hell yeah.” I’ve gotten back into surfing/the beach and I love that I can be in the water within an hour of rolling out of bed. I love my neighborhood, Atwater village. I think I’m so blessed that i can stroll up the street for great coffee or food and pick up a perfect bottle of wine. 
  > 
  > Weird how I haven’t mentioned the weather yet, which has drawn transplants from all over the world for decades. 
  > 
  > There’s lots of downsides. The cost of housing ensures that so many people can never really put down roots. I think LA can be a lonely place too. The job market is tough for people looking to move here and break into a new industry.  But if you can get past these things, it’s really the best place.

  - **LillyBolero** (Score: 23) - 3/1/2025, 10:16:37 AM
    > Yes! That Beck played for free back in the day at the EchoPlex even The Rolling Stones played a secret show there is wild.

    - **Silver-Firefighter35** (Score: 10) - 3/1/2025, 12:13:40 PM
      > I saw Beck at a coffee shop that I think was called Onyx. They would drop a shot of espresso into your coffee to make it extra strong

      - **LillyBolero** (Score: 5) - 3/1/2025, 8:03:09 PM
        > I love it…Onyx was where Cafe Figaro now stands in Los Feliz.

        - **LilyBartSimpson** (Score: 4) - 3/1/2025, 8:21:49 PM
          > Time to go again! Tarantino, who now owns the adjoining Vista Theater, converted it into Pam’s Coffy (yes, the y is on purpose). The name (and decor) is an homage to Pam Grier and her films including . . . Coffy (1973).

          - **LillyBolero** (Score: 4) - 3/1/2025, 8:55:08 PM
            > I’m familiar and definitely need to try but for the record that’s not the same space as Cafe Figaro that’s on Vermont/Los Feliz. 🌸

      - **thepostofficegirl01** (Score: 3) - 3/1/2025, 8:54:57 PM
        > I feel like if you live in LA long enough you’ll see Beck somewhere. Particularly if you hang out around Silverlake/Echo Park/Highland. There was a period like two years ago where I ran into him several times at various parties, venues etc haha

  - **annaoze94** (Score: 12) - 3/1/2025, 11:32:10 AM
    > It's such a lonely place. I miss Chicago where I was just surrounded by people just on the train to work. You don't have to talk to them but just knowing they're around is so much better than the isolation of your car

    - **SlowSwords** (Score: 12) - 3/1/2025, 11:40:08 AM
      > I used to live in sf, so I know what you mean. Ive seen people report being lonely because they move here and have a hard time making new friends and that people are a bit closed off. Increasingly people are sort of lonelier in general too and living in a city where many people just go to work in their car or work from home and order DoorDash doesn’t really help. 
      > 
      > I will say that my neighborhood is very active. Lots of people always walking around and friendly neighbors. Just walking down the street to proof for a coffee or something makes me feel part of the community.

    - **Silver-Firefighter35** (Score: 7) - 3/1/2025, 12:14:46 PM
      > I get that on the trains here. Once a guy complimented my socks, which I still appreciate.

    - **beyphy** (Score: 7) - 3/1/2025, 4:34:37 PM
      > You can take the trains or more typically busses in LA too. It just tends to be an option that people tend to not think about. Even if it's not a realistic option for work, you could take it on the weekends.

  - **No_Establishment1293** (Score: 4) - 3/1/2025, 1:41:42 PM
    > We neighbs

    - **SlowSwords** (Score: 3) - 3/1/2025, 3:24:54 PM
      > It’s the best

- **Worried-Rough-338** (Score: 65) - 3/1/2025, 8:57:13 AM
  > I lived in Pasadena for 20+ years before leaving for a more affordable life, specifically to buy a house. But my wife and I are desperately trying to make our way back. It’s hard to say exactly what we miss. The diversity and variety? The sheer scale of it? The weather? The food? The entrepreneurialism? The history? The freedom? The stairway down to Crystal Cove? Dodger Stadium? Riding a motorbike down a deserted Grand Avenue at 3AM? I don’t know: Los Angeles just has a vibe like nowhere else on Earth.

  - **jmt85** (Score: 6) - 3/1/2025, 3:54:05 PM
    > It’s the palm tree lined sunsets, the luring nature of the sea as juxtaposed against the sand topped off with some of the best Carne Asada known to mankind!

- **Khowdung-Flunghi** (Score: 20) - 3/1/2025, 8:44:02 AM
  > “Rollin down, Imperial Highway
  > 
  > With a big nasty redhead at my side…”

- **bce13** (Score: 21) - 3/1/2025, 9:27:42 AM
  > Yeah, gosh, why don’t you live in Bakersfield or Lubbock. So much cheaper. Because those cities profoundly suck and LA is amazing!!! We pay more to not live in a shitty city.

- **Sensitive-Ad4476** (Score: 58) - 3/1/2025, 8:57:59 AM
  > I can go right up the mountain and be in miles and miles of beautiful pine forests, 30 minutes the other way and I’m on a cliff watching the ocean, 1hr 30 I’m in Joshua tree. Love the proximity to nature year round

  - **aaaa2016aus** (Score: 5) - 3/1/2025, 11:55:23 AM
    > waitt which forest?? angeles national forest or am i missing one? LOL also any good solo hikes/viewpoints there?

- **Initial_Economist655** (Score: 40) - 3/1/2025, 8:42:10 AM
  > i’m leaving at the end of march for cheaper pastures but i’ll definitely miss the weather and getting to see interesting lesser known comedy or bands that don’t tour in the midwest. the food scene is amazing too, with so much variety. you can try anything here.

- **Alisa_Ta** (Score: 14) - 3/1/2025, 9:34:00 AM
  > Honestly, love the weather. I used to be in a situation where I was sick 12 months a year, and as I moved here the climate change helped me so much. I love how it is very different from my country, it kinda brings that spark to my life. I like how there isn’t much of gray, or brown Soviet Union styled depressing buildings. Damn I used to hear the “I wanna return back to my country so bad” and that really made me mad. LA is one of the best cities I’ve seen. It’s diverse, from Chinatown to DTLA to Malibu. The food here tastes good, not artificial. The people who live here are really open minded, compared to other places. So let’s just cherish the moments we live, appreciating every single part of the city!

- **septembereleventh** (Score: 12) - 3/1/2025, 10:02:18 AM
  > Later in life I realized that I like following sports. Having an emotional investment in the Lakers and the Dodgers has been paying off pretty well.

- **littlelostangeles** (Score: 14) - 3/1/2025, 10:10:16 AM
  > LA is so diverse and well-rounded that there is truly something for everyone, no matter how niche or mainstream your interests might be. Spend any amount of time in any place where there isn’t much to do or everything revolves around just a few activities, and you’ll never take it for granted again.

- **LillyBolero** (Score: 11) - 3/1/2025, 10:12:37 AM
  > I love the flock of geese that fly over my house to Echo Park lake every morning and evening

  - **No_Establishment1293** (Score: 3) - 3/1/2025, 1:45:21 PM
    > Im way into the parrots

- **Plat0LikedIt** (Score: 26) - 3/1/2025, 9:02:14 AM
  > LA’s just cooler than other places. It’s vibrant with lots of cultures and industries, the weather is fucking awesome, there’s tons of great beaches, there is a group of a particular interest for every kind. I love it here. There’s a reason why the best of the best choose to reside here

- **Chemical_Result_8033** (Score: 10) - 3/1/2025, 8:59:20 AM
  > I’m not a native, but was brought to Pasadena when I was five. I’ve lived in many different places, but when I recently retired, I returned to a new and better Pasadena. It’s a city with all the cool things that come with that, but it’s small enough that I got to meet the mayor and hear him talk about our city and what his priorities are to keep it special. Unlike some parts of the vast Los Angeles metropolitan region, it has a distinct sense of place, interesting local history, beautiful architecture and gorgeous natural areas right in town. The proximity to the mountains, the ethnic diversity, excellent health care, the walkable neighborhoods, and the plan to expand bike lanes, lots of civic engagement, I love it here!

- **mpaladin1** (Score: 10) - 3/1/2025, 10:01:28 AM
  > The variety of things to do. Almost anything you want to do you can within a reasonable drive. 
  > 
  > Surf: pick a beach, there is usually one less than an hour away. 
  > 
  > Ski: Big bear is less than two hours away
  > 
  > Theme park: take your pick we have five major parks and several minor ones
  > 
  > See a show: Pantages, Ahmanson, and a handful of minor ones, and dozens of black box/community theaters
  > 
  > Fresh water sports: several lake and the Colorado River is 5 hours away. 
  > 
  > Drive a tank: four and half hours to Vegas

- **Fine-Hedgehog9172** (Score: 11) - 3/1/2025, 10:32:46 AM
  > I live in The Palisades and the sense of community as we rebuild our town is really inspiring. The amount of support we have gotten for all across the city has been spectacular. I love LA!

- **R3ckl3ss** (Score: 20) - 3/1/2025, 9:04:59 AM
  > There’s nowhere else I can do what I do, make the money I make, and live the life that i live. 
  > 
  > My life here is magic. 
  > 
  > When people hate on LA I can absolutely see everything they see. But for me, the life I’m able to lead here is unmatched.

  - **azorahai805** (Score: 10) - 3/1/2025, 10:09:00 AM
    > What do u do

- **pikay93** (Score: 20) - 3/1/2025, 9:33:30 AM
  > There isn't just one. I have a list:
  > 
  > 1. This place's values mostly align with my own, especially in this day &amp; age.
  > 2. It's a major world destination and it's intersting to see people's reactions when i tell them i live here on my travels. 
  > 3. The space stuff (and i teach physics on top of that)
  > 4. LAX doesn't have a single airline dominating and so competition lowers prices.
  > 5. BUR
  > 6. Interesting to see local areas on tv b/c of filming locations/hollywood.
  > 7. Large Armenian population here (I'm Armenian myself)
  > 8. No severe weather
  > 9. Food
  > 10. Proximity to nature

  - **mcppe20** (Score: 8) - 3/1/2025, 11:41:15 AM
    > Are you Armenian? If so, thank you for your glorious food.

    - **pikay93** (Score: 4) - 3/1/2025, 9:43:57 PM
      > Indeed I am and you're welcome

- **brianneisamuffin** (Score: 17) - 3/1/2025, 10:19:08 AM
  > I tell people I’d take a bad day in LA over a good day in NYC… moving here saved my mental health. Access to sunshine, nature and environments of all kinds, being able to sit on the beach in February, incredible art museums… LA has everything. You can live here well and fairly cheaply if you’re smart about it, but I’d rather  be eating beans all week long so
  > I can afford other luxuries here. It’s the best place on earth.

- **snizzrizz** (Score: 17) - 3/1/2025, 10:26:15 AM
  > Everything happens here. Limited movie premiere? We got it. Concert tour? Stopping here. Designer clothing pop ups? Yep. 
  > 
  > LA is the best because it’s a market that the entire planet recognizes and utilizes. We are so close to the pulse of everything happening. It’s awesome

- **Careless_Relative_66** (Score: 9) - 3/1/2025, 9:56:41 AM
  > If you have interests, it’s an interesting place to call home. 

- **EatingAllTheLatex4U** (Score: 8) - 3/1/2025, 9:57:17 AM
  > Access to everything. 
  > 4-6 hours to Yosemite, hour to the ocean (sfv), two hours to snow, night life. 
  > 
  > 
  > Then the cycling. 
  > 
  > 
  > Plus no shoveling snow. 

- **danramos** (Score: 8) - 3/1/2025, 9:59:07 AM
  > Getting paid for ANY WORK THAT YOU DO.

- **hampstr2854** (Score: 8) - 3/1/2025, 1:13:29 PM
  > I came to LA in 1977 for the television industry to discover the gay Lucille Ball. I soon was told by a kind agent that one as " too gay for tv" (he was right by the way) but I had amazing experiences. In the process of finding a career I was a baby sitter and ended up in homes with Oscars, Grammys, Emmys on casual display. I went to Disneyland with one of the biggest stars in the music industry in a chauffered RV and two guides with line passes and total VIP treatment. I helped another Oscar and Grammy winner fill out lottery tickets at 7-11 one afternoon. One parent hired me as a p.a. and helped keep me employed for 20 years. Then I found another job working in the arts, a career, for another 20 years. I was able to adopt two children, support a family is 3, buy a home and retire securely. I'd never be able to do any of that anywhere else in this country. I will love L.A. forever!

- **donng141** (Score: 8) - 3/1/2025, 1:41:29 PM
  > I grew up in LA didn't realize that every day blue sky were not the norm til I traveled.

- **djbigtv** (Score: 6) - 3/1/2025, 9:39:38 AM
  > The tacos

- **Soupy_Jones** (Score: 6) - 3/1/2025, 9:47:10 AM
  > Cool shows and old theaters

- **AltruisticFriend5721** (Score: 6) - 3/1/2025, 10:41:34 AM
  > Catching the view of downtown from random places as I drive. Like that one curve on Montecito Dr at sunset when the building have that red and purple background. Too tier.

- **Silver-Firefighter35** (Score: 7) - 3/1/2025, 12:11:16 PM
  > Just near Pasadena: The Huntington, the Arroyo, breakfast at The Reyn, Echo Mountain, Agnes, Union, that huge park at the end of Lake that you can only go on weekdays, Vroman’s, All India, Saladang, Porto Via, Bulgarini, Norton Simon, Eaton Canyon. The Rose Parade. Plus easy drive to all kinds of great beaches with the kids on weekends. And camping in the Angeles Forest. You can be downtown in 10-15 minutes on weekends and see amazing architecture and have lunch in Little Tokyo. Or easy drive for dim sum in the SGV. I live in Echo Park now, love it, but miss Pasadena.

- **maxplanar** (Score: 6) - 3/1/2025, 12:32:00 PM
  > I live in Laurel Canyon.  Apart from many mammals like deer, raccoons, squirrels, gophers (grrrr little bastards) and coyotes (never seen a puma….yet), we see more than 35 different species of birds throughout the year.   On a daily basis more than 25.   It’s truly spectacular and I’d think pretty unusual to live in the middle of such a large global city and have so much wildlife around us every day.

- **No_Establishment1293** (Score: 7) - 3/1/2025, 1:39:48 PM
  > I’ll go! I’m a pretty notorious “LA hater” despite having lived here since 2015 and in VTA county off and on since 2000.
  > 
  > When we moved here i was pissed at my parents. I loved where I was from (north of Seattle) and thought LA was the ugliest, most impersonal shitbag area in the world. That mindset persisted through years of moving back and forth between there and the PNW until I finally settled in 2012 here (2015 for LA proper).
  > 
  > Ill be honest, I still held a lot of hate until maybe last year. I started realizing via the rants of friends back home in kinda redneck areas how backwards some of my thinking was. I also made an effort to learn about the natives here, how they managed the land, and then moving forward how truly beautiful our winters are, then conceding that long beach is a great city, then how redondo has a perfect beach… the list kind of grew.
  > 
  > To today, I recall trying to grow pink jasmine on one of my stints back in Washington, and it failing. I have a gorgeous jasmine bush outside my window I have been cultivating for three years that finally gave me heady, full aromas this week. I have been enjoying that so much, and realized today that that very aroma was one of the first things i associated with being here years ago that i ever liked.
  > 
  > But we have so much to offer. And Californians truly generally do band together in a way I cannot say Washingtonians do (i love you all). I dunno what exactly it is- maybe the political climate- but I find myself starting to argue back on fuckers that shit on California like I’m a sibling saying no one can fuck with it except me (or anyone who actually lives here). I also deeply agree with the sentiment that real LA happens south of the 10. 
  > 
  > Anyway that’s my experience. I am a convert and it took fucking YEARS. I may get hate but that’s what I got. Also Ventura is beautiful but fuck that place.

- **Coomstress** (Score: 6) - 3/1/2025, 9:08:27 AM
  > Diversity, weather, friendliness, endless things to do!

- **JoBrosHoes93** (Score: 4) - 3/1/2025, 9:45:00 AM
  > The weather the weather the weather?

- **Edenwing** (Score: 5) - 3/1/2025, 10:13:12 AM
  > We have some of the best scenic drives in the US if you like sports cars or bikes.
  > 
  > It’s 1-2 hours to the beach and 2-3 hours to the ski slopes.

- **Intelligent-Year-760** (Score: 4) - 3/1/2025, 11:19:03 AM
  > Food. Most diverse food city in the world. Sad that it’s twice as expensive to eat anywhere than it used to be but I will never stop appreciating just how easy it is to get above average if not the best possible versions of almost every type of cuisine on the planet in this city.

  - **lawyers_guns_nomoney** (Score: 4) - 3/1/2025, 2:04:40 PM
    > The funny thing is that when I travel, food isn’t *that* much cheaper even in smaller cities, especially if you go to the nicer/hipper spots (and a lot of places don’t have decent cheap food like tacos that we do). I think everyone just got destroyed by COVID and inflation. 
    > 
    > The one thing I find is usually cheaper is beer and drinks. Dunno if it is taxes or what but we pay a fuckton compared to other places.

- **According-Entrance67** (Score: 5) - 3/1/2025, 11:36:28 PM
  > I Love every bit of it. I’ve lived in “cheaper cities,” I’ve lived in and worked in more costly cities, all across the world. But Mainly, I live here and love our diversity; of people, cultures, ideas, food, geography and weather.

- **JohnnySweatpantsIII** (Score: 18) - 3/1/2025, 9:03:45 AM
  > Latinas

- **redvariation** (Score: 3) - 3/1/2025, 9:46:08 AM
  > Weather, beach, mountains, desert,  major airport

- **Ohlookitstoppdsnowin** (Score: 3) - 3/1/2025, 10:48:40 AM
  > I am not scared to live in LA.

- **CaleyB75** (Score: 3) - 3/1/2025, 4:04:46 PM
  > When I lived in LA, I liked the mix of cultures, hiking in the hills, and the good book and music stores downtown.

- **annaoze94** (Score: 3) - 3/1/2025, 11:31:32 AM
  > Gardening in the winter.

- **PerformanceMurky407** (Score: 3) - 3/1/2025, 7:25:30 PM
  > I really like the high-low nature of LA. You can get really good options on food and entertainment for cheap and expensive and usually they’re both worth it!

- **bce13** (Score: 3) - 3/1/2025, 8:00:26 PM
  > The many small businesses in my neighborhood that I can walk to for nearly every need. The food. The sky, particularly in the fall months. The proximity to hiking. And beaching. The vibrant diverse culture — which is reflected in our amazing dining options. The way communities and neighbors come together during collective tragedy. The old theaters that play classic movies. The farmer’s markets. And our grocery stores and small markets. You can find absolutely everything you can dream up in LA. Every niche creature comfort.

- **sonorakit11** (Score: 7) - 3/1/2025, 9:10:58 AM
  > My favorite LA things:
  > 
  > - Largo
  > - Dynasty Typewriter
  > - Monty’s 
  > - the Riverside and Burbank Ranchos
  > - galloping through Griffith park
  > - working at a horse barn with an LA zip code
  > - having merch from a production I worked on
  > - seeing my name in credits
  > - the weather
  > - the plants
  > - so much more…

  - **brianneisamuffin** (Score: 3) - 3/1/2025, 10:19:51 AM
    > Fuck yeah Largo!!

  - **BookkeeperSame195** (Score: 3) - 3/1/2025, 2:03:15 PM
    > working with horses in the city would be a dream job. how did you get into that? love the rancho - the smell of horses is soul soothing to me- and it never gets old seeing people riding down the street toward the park at night in a major metropolitan area. it feels especially LA to me.

- **cathaysia** (Score: 3) - 3/1/2025, 9:12:19 AM
  > How walkable it is. How much delicious cuisine there is. How much nightlife there is. And all while I’m wearing a tank top and light jacket.

  - **fastone1911** (Score: 8) - 3/1/2025, 11:49:28 AM
    > WALKABLE????

    - **cathaysia** (Score: 4) - 3/1/2025, 11:52:46 AM
      > WALKABLE!!!

      - **fastone1911** (Score: 10) - 3/1/2025, 12:03:40 PM
        > YOU MUST HAVE BIG LONG LEGS!!!

---

### Post 2: Anyone know a good place in LA where I can scream at the top of my lungs?

**Author:** Longjumping-Sun-9213  
**Subreddit:** r/AskLosAngeles  
**Created:** 3/2/2025, 7:46:31 AM  
**Score:** 199 (92% upvoted)  
**Comments:** 172  
**URL:** [https://www.reddit.com/r/AskLosAngeles/comments/1j1g8uu/anyone_know_a_good_place_in_la_where_i_can_scream/](https://www.reddit.com/r/AskLosAngeles/comments/1j1g8uu/anyone_know_a_good_place_in_la_where_i_can_scream/)  

**Content:**

> Like a really good loud emotional-release scream
> 
> Been under a lot of stress lately and am feeling very depressed, angry and sad.. . need to let it out somewhere before I lose my mind. Preferably with a good view of the city maybe. And somewhat private 🤗🙏🏼
> 
> Any recs?

#### Comments:

- **AutoModerator** (Score: 1) - 3/2/2025, 7:46:32 AM
  > This is an automated message that is applied to every post. Just a general reminder, /r/AskLosAngeles is a friendly question and answer subreddit for the region of Los Angeles, California. Please follow [the subreddit rules](/r/AskLosAngeles/about/rules/), report content that does not follow rules, and feel empowered to contribute to the [subreddit wiki](https://www.reddit.com/r/AskLosAngeles/wiki/) or to ask questions of your fellow community members. The vibe should be helpful and friendly and the quality of your contribution makes a difference. Unhelpful comments are discouraged, rude interactions are bannable.
  > 
  > *I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](/message/compose/?to=/r/AskLosAngeles) if you have any questions or concerns.*

- **North_Reception_1335** (Score: 1) - 3/2/2025, 7:51:09 AM
  > I just do it in the car while driving on the freeway lol.
  > 
  > Also hang in there, you are not alone &lt;3

  - **momemata** (Score: 1) - 3/2/2025, 8:15:15 AM
    > I did this one time and was hitting my steering wheel and looked over and the person gave me the thumbs up, a huge smile, and started doing the same

    - **MichaelMidnight** (Score: 1) - 3/2/2025, 9:24:54 AM
      > THIS IS WONDERFUL TO READ

    - **kosherchristmas** (Score: 1) - 3/2/2025, 11:11:59 AM
      > What a magical LA moment

    - **peacenchemicals** (Score: 1) - 3/2/2025, 11:19:18 AM
      > lol similar thing happened to me minus the screaming at the top of my lungs (i did that at home once in my pillow)
      > 
      > i was vibing HARD as FUCK to my favorite track of the moment. some blog house banger from back in like 2008/2009. i was fucking VIBING bro. going crazy
      > 
      > i look over to my left and a couple girls saw me and laughed and waved. i felt my face flush over with embarrassment lol

  - **pingucat** (Score: 1) - 3/2/2025, 7:57:31 AM
    > yes car!

  - **secretslutonline** (Score: 1) - 3/2/2025, 7:58:51 AM
    > Same! And I belt out my fav jams in traffic too lol

  - **ororon** (Score: 1) - 3/2/2025, 7:59:20 AM
    > oh I’m not alone 😂

  - **ttnezz** (Score: 1) - 3/2/2025, 8:06:03 AM
    > Agreed. I do this all the time.

  - **ThatllTeachM** (Score: 1) - 3/2/2025, 8:32:43 AM
    > I was about to say this

  - **AboveMoonPeace** (Score: 1) - 3/2/2025, 9:16:35 AM
    > Came here to say this . Pick any horrible freeway- 405, 101….

  - **randojpg** (Score: 1) - 3/2/2025, 9:32:02 AM
    > I've done this before. No shame whatsoever

  - **DiscoMothra** (Score: 1) - 3/2/2025, 9:35:16 AM
    > Was totally going to suggest this. It really works.

  - **FancyAdult** (Score: 1) - 3/2/2025, 9:49:16 AM
    > This. I had so much anger and feeling of rejection last year and I found that screaming in my car on the freeway was therapeutic. Scream, cry, all of the above.

  - **Whole_Interaction808** (Score: 1) - 3/2/2025, 9:17:17 AM
    > Came here to say this lol

  - **Wax_and_Wane** (Score: 1) - 3/2/2025, 9:39:56 AM
    > [Dory Previn has an LA song for this! ](https://www.youtube.com/watch?v=O35PTBEw8F8)

- **NCreature** (Score: 1) - 3/2/2025, 7:50:04 AM
  > To be honest you could do this in the middle of Hollywood Blvd and no one would care. Though someone may have beaten you to it.

  - **ltzltz1** (Score: 1) - 3/2/2025, 8:42:41 AM
    > 😭 exactly nobody would bat* an eyelash

    - **LosAngelesTacoBoi** (Score: 1) - 3/2/2025, 8:51:53 AM
      > Pretty sure you can also buy bags of eyelashes on Hollywood Blvd.

  - **PM_your_Nopales** (Score: 1) - 3/2/2025, 8:47:22 AM
    > In fact, it'll add to the ambiance. If i go there for whatever reason and there isn't screaming i get concerned

  - **stolenhello** (Score: 1) - 3/2/2025, 11:28:56 AM
    > People would absolutely stare at you like a crazy. What are yall smoking?

- **Evilbuttsandwich** (Score: 1) - 3/2/2025, 7:56:19 AM
  > If you check r/SantaMonica theres somebody who’s been having a homeless woman screaming at their apartment complex nonstop for weeks. I say join in. 
  > 
  > https://www.reddit.com/r/SantaMonica/comments/1iuvjq5/the_screaming_lady_is_making_me_spiral_pt_iv/

  - **hannahjams** (Score: 1) - 3/2/2025, 7:59:52 AM
    > lol I’ve been following this saga as well

    - **mliz8500** (Score: 1) - 3/2/2025, 9:21:15 AM
      > Honestly I’m glad she’s moving, it sounds awful. I don’t know why anyone lives downtown, it’s so noisy! Much better after 11th…

      - **hannahjams** (Score: 1) - 3/2/2025, 9:23:50 AM
        > I would have lost my mind by now! I’m glad she’s moving too. I wish her a life time of quietness after this

  - **Critical_Guidance_24** (Score: 1) - 3/2/2025, 8:45:30 AM
    > I work over night in Santa Monica and I know exactly what woman they’re talking about 😂

- **AlpineInquirer** (Score: 1) - 3/2/2025, 7:48:31 AM
  > Beach. No one will hear or care.

  - **DarkTorus** (Score: 1) - 3/2/2025, 7:57:11 AM
    > Specifically dockweiler where the planes take off.

  - **itsmicah64** (Score: 1) - 3/2/2025, 7:49:06 AM
    > I second beach

- **director_guy** (Score: 1) - 3/2/2025, 7:51:49 AM
  > Head to Magic Mountain for some scream therapy

  - **PriorPuzzleheaded990** (Score: 1) - 3/2/2025, 8:27:52 AM
    > But don’t actually get on any rides, just scream while in the lines waiting

  - **croqueticas** (Score: 1) - 3/2/2025, 8:58:02 AM
    > I have a pass for another park for a reason, those screams are therapeutic as hell. Need to do it at the end of every quarter 

- **snizzrizz** (Score: 1) - 3/2/2025, 7:52:21 AM
  > According to my kids it’s the backseat of my car when we’re stuck in traffic

- **Superb_Pay_737** (Score: 1) - 3/2/2025, 7:56:14 AM
  > karaoke ! ktown

- **sector9love** (Score: 1) - 3/2/2025, 7:52:10 AM
  > Honestly, I do my best screaming in my car in parking garages

- **Chikitiki90** (Score: 1) - 3/2/2025, 7:56:17 AM
  > Depends on how self conscious you are. Personally I’d scream into my pillow while the house is empty but if you have no shame, the city is your oyster lol.

- **RecklessCreature** (Score: 1) - 3/2/2025, 8:12:59 AM
  > Like anywhere. It’s LA. No one cares. Just scream right now wherever you are.

- **SnooDucks5098** (Score: 1) - 3/2/2025, 7:53:44 AM
  > At the car wash

- **PigDaddyX** (Score: 1) - 3/2/2025, 8:08:15 AM
  > Mount Wilson.

- **MathematicianNo2689** (Score: 1) - 3/2/2025, 8:16:54 AM
  > Dodger Stadium. Wear something blue and nobody will bat an eyelid. 

- **moemoe7012** (Score: 1) - 3/2/2025, 8:25:13 AM
  > Protests. Find one that means something to you. Tenant rights protests against rent hikes and the LLC landlords who are harassing the working class always does it for me. Feels good to stand up against the system and let it out! Goodluck finding release!

- **PimpRobot818** (Score: 1) - 3/2/2025, 7:59:59 AM
  > In the middle of Vons

  - **PayFormer387** (Score: 1) - 3/2/2025, 8:09:23 AM
    > Ralph’s is better. Tue bakery section at Vons kinda sucks.

    - **Global_Reading6123** (Score: 1) - 3/2/2025, 9:12:45 AM
      > Trader Joe's parking lot

    - **mliz8500** (Score: 1) - 3/2/2025, 10:14:31 AM
      > There was a fella doing just that at the Ralph’s in Santa Monica earlier this evening. Could have made a chorus.

- **K_user1234** (Score: 1) - 3/2/2025, 8:03:01 AM
  > I think you may enjoy this: https://rageground.com/

- **Character-Ad4498** (Score: 1) - 3/2/2025, 8:11:49 AM
  > Drive up north into the canyon. That’s where I go to escape when this place makes me want to lose it :)

- **Bridge_The_Person** (Score: 1) - 3/2/2025, 9:18:25 AM
  > Not a lot of real answers here. This gets asked relatively often and the real answer is practice rooms. 
  > 
  > Any music practice space will have adequate soundproofing for you to yell as much as you’d like. Drumming ones are best insulated.
  > 
  > They’re for rent all over the city for an hour and people make all kinds of art, among them are ones with screaming, so you won’t seem out of place.
  > 
  > It’s fine you’d like to scream as an outlet, it’s a good outlet. Take the best care of yourself you can, and if you feel able drag yourself to a support group.
  > 
  > LACDMH has this site that will let you talk to someone at any time:
  > 
  > https://lacounty.iprevail.com/chat?rsc=la_go_1&amp;gad_source=1&amp;gbraid=0AAAAADiZhlu0iRFK3ug8eoJwYoXg53WLA

- **Dense_Diver_3998** (Score: 1) - 3/2/2025, 8:00:47 AM
  > 2nd st tunnel, get a good echo off it.

- **Kooky_Grand8128** (Score: 1) - 3/2/2025, 8:01:40 AM
  > Six flags I promise you

- **ISmellYerStank** (Score: 1) - 3/2/2025, 8:05:30 AM
  > Forest Lawn

- **JackMiof2** (Score: 1) - 3/2/2025, 8:10:47 AM
  > Your car or the beach.

- **Unlikely-Ratio-897** (Score: 1) - 3/2/2025, 8:12:03 AM
  > Car wash coin op Main st Santa Monica

- **MarzyXP** (Score: 1) - 3/2/2025, 8:12:07 AM
  > The car. I do it every morning before work. Not kidding btw.

- **Moparian714** (Score: 1) - 3/2/2025, 8:12:29 AM
  > You can come to my job. We scream at the top of our lungs in the shop every day

- **Planting4thefuture** (Score: 1) - 3/2/2025, 8:15:29 AM
  > Anywhere in dtla you’ll blend right in. On the fwy in your car is a good one I saw here lol.

- **Last-Cockroach-6218** (Score: 1) - 3/2/2025, 8:15:57 AM
  > as the economy gets worse and worse, and more and more people get laid off, and more and more SFH are bought by fintech,  more and more people will want places like this

- **momemata** (Score: 1) - 3/2/2025, 8:16:36 AM
  > I also tell my kid to scream and I scream with him, then apologize to my neighbors that he just needed to scream.

- **CampinHiker** (Score: 1) - 3/2/2025, 8:19:36 AM
  > Go on the side of PCH near LAX when the planes fly above you

- **Sarahclaire54** (Score: 1) - 3/2/2025, 8:19:42 AM
  > On the 405 in your car, at the top of your lungs. I have done it before!!!

- **sleepingovertires** (Score: 1) - 3/2/2025, 8:37:46 AM
  > On Lincoln in Venice Beach while naked on meth. 
  > 
  > I’ve seen it, so I know it’s a thing.

- **10k_Uzi** (Score: 1) - 3/2/2025, 8:41:46 AM
  > LA river dude

- **Heavy-Syrup-6195** (Score: 1) - 3/2/2025, 8:41:50 AM
  > Not sure if they’re still around, but there are places that allow you to rent a room full of random items that you can bash with your weapon of choice.

- **ThereCanOnlyBeOnce** (Score: 1) - 3/2/2025, 8:43:00 AM
  > maybe try a rage room

- **LaMelonBallz** (Score: 1) - 3/2/2025, 8:46:04 AM
  > Check out some of the rage rooms around the city, scream, yell, break things with a hammer, whatever you need to get it all out

- **Beginning-Cup4605** (Score: 1) - 3/2/2025, 8:47:43 AM
  > Check out the rage room in DTLA

- **_its_a_SWEATER_** (Score: 1) - 3/2/2025, 8:57:55 AM
  > Angeles Crest Hwy

- **Sharktomus** (Score: 1) - 3/2/2025, 9:39:20 AM
  > Magic Mountain or Knotts Berry Farm 

- **triaura** (Score: 1) - 3/2/2025, 10:32:16 AM
  > Muholland Drive

- **FPYHS** (Score: 1) - 3/2/2025, 10:52:32 AM
  > J

- **TheBear8878** (Score: 1) - 3/2/2025, 11:43:31 AM
  > Brother, it's LA. Just do it in the street at 9pm like all the other people around here

- **SanDiego_32** (Score: 1) - 3/2/2025, 8:00:35 AM
  > Skid Row

- **hampikatsov** (Score: 1) - 3/2/2025, 7:48:25 AM
  > Just go hiking somewhere in griffith park and when no ones around yeah do the deed

- **Prestigious-Cake-228** (Score: 1) - 3/2/2025, 7:51:30 AM
  > LAX

- **Ordinary_Resident_20** (Score: 1) - 3/2/2025, 7:56:35 AM
  > Scream into your towel in your car 🫶🏼

- **Rollins10** (Score: 1) - 3/2/2025, 7:59:00 AM
  > Fashion district

- **sha1dy** (Score: 1) - 3/2/2025, 7:59:04 AM
  > skid row

- **CosmicallyF-d** (Score: 1) - 3/2/2025, 8:00:39 AM
  > Well... I mean you wouldn't be unique doing so but anywhere in Santa Monica center. You're probably have a couple of screamers within a block of you.

- **EnlightenedIdiot1515** (Score: 1) - 3/2/2025, 8:03:45 AM
  > Any metro station, especially on the B line

- **PayFormer387** (Score: 1) - 3/2/2025, 8:07:50 AM
  > The Metro C line station at the 110 freeway. Or the Willowbrook/Rosa Parks station. Depends on the view you want.

- **awol_evan** (Score: 1) - 3/2/2025, 8:12:44 AM
  > Head to the beach if you can. Screaming into the vast blue has to be cathartic.

- **nodogbutdog** (Score: 1) - 3/2/2025, 8:13:16 AM
  > Sign up for a slotted open mic. Rant about your life and then step away from the mic and scream into the wall. You might get some laughs from comics.

- **rabidgoldenbear** (Score: 1) - 3/2/2025, 8:15:06 AM
  > The upper parking lot at Dodger Stadium while looking at the downtown skyline

- **PizzaHutBookItChamp** (Score: 1) - 3/2/2025, 8:15:20 AM
  > Cedar Grove in Griffith park is a really special spot overlooking the city. You can probably get in a couple of good screams there (more than a couple and people might call the cops?)
  > There are also some good spots up towards the Angeles Forest on the way to Switzer Falls. I believe there is a clearing off the side of the highway by the Clear Creek Fire Station. In the middle of nowhere. Good luck. 

- **soputmeonahighway** (Score: 1) - 3/2/2025, 8:19:47 AM
  > If you can’t find a lace to scream a big bucket of water balloons against a fence is super liberating, FYI!!! Best of Luck, let it RIP!!!!!

- **larrythegrobe** (Score: 1) - 3/2/2025, 8:21:01 AM
  > There are a number of musician practice rooms that you can rent around the city.

- **swdna** (Score: 1) - 3/2/2025, 8:24:59 AM
  > In your car! 😁

- **cranberrydudz** (Score: 1) - 3/2/2025, 8:25:06 AM
  > Downtown Los Angeles

- **EchoTrucha** (Score: 1) - 3/2/2025, 8:32:44 AM
  > Tujunga canyon

- **garyryan9** (Score: 1) - 3/2/2025, 8:33:43 AM
  > Message me I know all the lonely hiking spots lol

- **HambonesMcGee** (Score: 1) - 3/2/2025, 8:40:34 AM
  > I know some streets in Hollywood where this wouldn’t turn a single head

- **BroBeastDad** (Score: 1) - 3/2/2025, 8:49:40 AM
  > I do it in the shower lol I open my mouth and let water hit my mouth and fill up and then I start screaming lol works really good. OR! Under water that one hits THE BEST!

- **Over_Size_2611** (Score: 1) - 3/2/2025, 8:51:11 AM
  > Skid row. You’ll blend in with the crack heads.

- **TheObstruction** (Score: 1) - 3/2/2025, 8:53:46 AM
  > [I'm mad as Hell and I'm not going to take this anymore!](https://www.youtube.com/watch?v=_RujOFCHsxo)

- **Livexslow** (Score: 1) - 3/2/2025, 8:57:04 AM
  > literally any where😂 if any “normal” person is around they’ll just think you’re homeless and leave you alone

- **LynSukii** (Score: 1) - 3/2/2025, 8:59:27 AM
  > Like literally anywhere. Just do it.

- **Time_Medium_6622** (Score: 1) - 3/2/2025, 9:03:15 AM
  > Break room

- **astroboy7070** (Score: 1) - 3/2/2025, 9:05:54 AM
  > Beach

---

### Post 3: Anyone know a good place in LA where I can scream at the top of my lungs?

**Author:** Longjumping-Sun-9213  
**Subreddit:** r/AskLosAngeles  
**Created:** 3/2/2025, 7:46:31 AM  
**Score:** 195 (92% upvoted)  
**Comments:** 172  
**URL:** [https://www.reddit.com/r/AskLosAngeles/comments/1j1g8uu/anyone_know_a_good_place_in_la_where_i_can_scream/](https://www.reddit.com/r/AskLosAngeles/comments/1j1g8uu/anyone_know_a_good_place_in_la_where_i_can_scream/)  

**Content:**

> Like a really good loud emotional-release scream
> 
> Been under a lot of stress lately and am feeling very depressed, angry and sad.. . need to let it out somewhere before I lose my mind. Preferably with a good view of the city maybe. And somewhat private 🤗🙏🏼
> 
> Any recs?

#### Comments:

- **AutoModerator** (Score: 1) - 3/2/2025, 7:46:32 AM
  > This is an automated message that is applied to every post. Just a general reminder, /r/AskLosAngeles is a friendly question and answer subreddit for the region of Los Angeles, California. Please follow [the subreddit rules](/r/AskLosAngeles/about/rules/), report content that does not follow rules, and feel empowered to contribute to the [subreddit wiki](https://www.reddit.com/r/AskLosAngeles/wiki/) or to ask questions of your fellow community members. The vibe should be helpful and friendly and the quality of your contribution makes a difference. Unhelpful comments are discouraged, rude interactions are bannable.
  > 
  > *I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](/message/compose/?to=/r/AskLosAngeles) if you have any questions or concerns.*

- **North_Reception_1335** (Score: 1) - 3/2/2025, 7:51:09 AM
  > I just do it in the car while driving on the freeway lol.
  > 
  > Also hang in there, you are not alone &lt;3

  - **momemata** (Score: 1) - 3/2/2025, 8:15:15 AM
    > I did this one time and was hitting my steering wheel and looked over and the person gave me the thumbs up, a huge smile, and started doing the same

    - **MichaelMidnight** (Score: 1) - 3/2/2025, 9:24:54 AM
      > THIS IS WONDERFUL TO READ

    - **kosherchristmas** (Score: 1) - 3/2/2025, 11:11:59 AM
      > What a magical LA moment

    - **peacenchemicals** (Score: 1) - 3/2/2025, 11:19:18 AM
      > lol similar thing happened to me minus the screaming at the top of my lungs (i did that at home once in my pillow)
      > 
      > i was vibing HARD as FUCK to my favorite track of the moment. some blog house banger from back in like 2008/2009. i was fucking VIBING bro. going crazy
      > 
      > i look over to my left and a couple girls saw me and laughed and waved. i felt my face flush over with embarrassment lol

  - **pingucat** (Score: 1) - 3/2/2025, 7:57:31 AM
    > yes car!

  - **secretslutonline** (Score: 1) - 3/2/2025, 7:58:51 AM
    > Same! And I belt out my fav jams in traffic too lol

  - **ororon** (Score: 1) - 3/2/2025, 7:59:20 AM
    > oh I’m not alone 😂

  - **ttnezz** (Score: 1) - 3/2/2025, 8:06:03 AM
    > Agreed. I do this all the time.

  - **ThatllTeachM** (Score: 1) - 3/2/2025, 8:32:43 AM
    > I was about to say this

  - **AboveMoonPeace** (Score: 1) - 3/2/2025, 9:16:35 AM
    > Came here to say this . Pick any horrible freeway- 405, 101….

  - **randojpg** (Score: 1) - 3/2/2025, 9:32:02 AM
    > I've done this before. No shame whatsoever

  - **DiscoMothra** (Score: 1) - 3/2/2025, 9:35:16 AM
    > Was totally going to suggest this. It really works.

  - **FancyAdult** (Score: 1) - 3/2/2025, 9:49:16 AM
    > This. I had so much anger and feeling of rejection last year and I found that screaming in my car on the freeway was therapeutic. Scream, cry, all of the above.

  - **Whole_Interaction808** (Score: 1) - 3/2/2025, 9:17:17 AM
    > Came here to say this lol

  - **Wax_and_Wane** (Score: 1) - 3/2/2025, 9:39:56 AM
    > [Dory Previn has an LA song for this! ](https://www.youtube.com/watch?v=O35PTBEw8F8)

- **NCreature** (Score: 1) - 3/2/2025, 7:50:04 AM
  > To be honest you could do this in the middle of Hollywood Blvd and no one would care. Though someone may have beaten you to it.

  - **ltzltz1** (Score: 1) - 3/2/2025, 8:42:41 AM
    > 😭 exactly nobody would bat* an eyelash

    - **LosAngelesTacoBoi** (Score: 1) - 3/2/2025, 8:51:53 AM
      > Pretty sure you can also buy bags of eyelashes on Hollywood Blvd.

  - **PM_your_Nopales** (Score: 1) - 3/2/2025, 8:47:22 AM
    > In fact, it'll add to the ambiance. If i go there for whatever reason and there isn't screaming i get concerned

  - **stolenhello** (Score: 1) - 3/2/2025, 11:28:56 AM
    > People would absolutely stare at you like a crazy. What are yall smoking?

- **Evilbuttsandwich** (Score: 1) - 3/2/2025, 7:56:19 AM
  > If you check r/SantaMonica theres somebody who’s been having a homeless woman screaming at their apartment complex nonstop for weeks. I say join in. 
  > 
  > https://www.reddit.com/r/SantaMonica/comments/1iuvjq5/the_screaming_lady_is_making_me_spiral_pt_iv/

  - **hannahjams** (Score: 1) - 3/2/2025, 7:59:52 AM
    > lol I’ve been following this saga as well

    - **mliz8500** (Score: 1) - 3/2/2025, 9:21:15 AM
      > Honestly I’m glad she’s moving, it sounds awful. I don’t know why anyone lives downtown, it’s so noisy! Much better after 11th…

      - **hannahjams** (Score: 1) - 3/2/2025, 9:23:50 AM
        > I would have lost my mind by now! I’m glad she’s moving too. I wish her a life time of quietness after this

  - **Critical_Guidance_24** (Score: 1) - 3/2/2025, 8:45:30 AM
    > I work over night in Santa Monica and I know exactly what woman they’re talking about 😂

- **AlpineInquirer** (Score: 1) - 3/2/2025, 7:48:31 AM
  > Beach. No one will hear or care.

  - **DarkTorus** (Score: 1) - 3/2/2025, 7:57:11 AM
    > Specifically dockweiler where the planes take off.

  - **itsmicah64** (Score: 1) - 3/2/2025, 7:49:06 AM
    > I second beach

- **director_guy** (Score: 1) - 3/2/2025, 7:51:49 AM
  > Head to Magic Mountain for some scream therapy

  - **PriorPuzzleheaded990** (Score: 1) - 3/2/2025, 8:27:52 AM
    > But don’t actually get on any rides, just scream while in the lines waiting

  - **croqueticas** (Score: 1) - 3/2/2025, 8:58:02 AM
    > I have a pass for another park for a reason, those screams are therapeutic as hell. Need to do it at the end of every quarter 

- **snizzrizz** (Score: 1) - 3/2/2025, 7:52:21 AM
  > According to my kids it’s the backseat of my car when we’re stuck in traffic

- **Superb_Pay_737** (Score: 1) - 3/2/2025, 7:56:14 AM
  > karaoke ! ktown

- **sector9love** (Score: 1) - 3/2/2025, 7:52:10 AM
  > Honestly, I do my best screaming in my car in parking garages

- **Chikitiki90** (Score: 1) - 3/2/2025, 7:56:17 AM
  > Depends on how self conscious you are. Personally I’d scream into my pillow while the house is empty but if you have no shame, the city is your oyster lol.

- **RecklessCreature** (Score: 1) - 3/2/2025, 8:12:59 AM
  > Like anywhere. It’s LA. No one cares. Just scream right now wherever you are.

- **SnooDucks5098** (Score: 1) - 3/2/2025, 7:53:44 AM
  > At the car wash

- **PigDaddyX** (Score: 1) - 3/2/2025, 8:08:15 AM
  > Mount Wilson.

- **MathematicianNo2689** (Score: 1) - 3/2/2025, 8:16:54 AM
  > Dodger Stadium. Wear something blue and nobody will bat an eyelid. 

- **moemoe7012** (Score: 1) - 3/2/2025, 8:25:13 AM
  > Protests. Find one that means something to you. Tenant rights protests against rent hikes and the LLC landlords who are harassing the working class always does it for me. Feels good to stand up against the system and let it out! Goodluck finding release!

- **PimpRobot818** (Score: 1) - 3/2/2025, 7:59:59 AM
  > In the middle of Vons

  - **PayFormer387** (Score: 1) - 3/2/2025, 8:09:23 AM
    > Ralph’s is better. Tue bakery section at Vons kinda sucks.

    - **Global_Reading6123** (Score: 1) - 3/2/2025, 9:12:45 AM
      > Trader Joe's parking lot

    - **mliz8500** (Score: 1) - 3/2/2025, 10:14:31 AM
      > There was a fella doing just that at the Ralph’s in Santa Monica earlier this evening. Could have made a chorus.

- **K_user1234** (Score: 1) - 3/2/2025, 8:03:01 AM
  > I think you may enjoy this: https://rageground.com/

- **Character-Ad4498** (Score: 1) - 3/2/2025, 8:11:49 AM
  > Drive up north into the canyon. That’s where I go to escape when this place makes me want to lose it :)

- **Bridge_The_Person** (Score: 1) - 3/2/2025, 9:18:25 AM
  > Not a lot of real answers here. This gets asked relatively often and the real answer is practice rooms. 
  > 
  > Any music practice space will have adequate soundproofing for you to yell as much as you’d like. Drumming ones are best insulated.
  > 
  > They’re for rent all over the city for an hour and people make all kinds of art, among them are ones with screaming, so you won’t seem out of place.
  > 
  > It’s fine you’d like to scream as an outlet, it’s a good outlet. Take the best care of yourself you can, and if you feel able drag yourself to a support group.
  > 
  > LACDMH has this site that will let you talk to someone at any time:
  > 
  > https://lacounty.iprevail.com/chat?rsc=la_go_1&amp;gad_source=1&amp;gbraid=0AAAAADiZhlu0iRFK3ug8eoJwYoXg53WLA

- **Dense_Diver_3998** (Score: 1) - 3/2/2025, 8:00:47 AM
  > 2nd st tunnel, get a good echo off it.

- **Kooky_Grand8128** (Score: 1) - 3/2/2025, 8:01:40 AM
  > Six flags I promise you

- **ISmellYerStank** (Score: 1) - 3/2/2025, 8:05:30 AM
  > Forest Lawn

- **JackMiof2** (Score: 1) - 3/2/2025, 8:10:47 AM
  > Your car or the beach.

- **Unlikely-Ratio-897** (Score: 1) - 3/2/2025, 8:12:03 AM
  > Car wash coin op Main st Santa Monica

- **MarzyXP** (Score: 1) - 3/2/2025, 8:12:07 AM
  > The car. I do it every morning before work. Not kidding btw.

- **Moparian714** (Score: 1) - 3/2/2025, 8:12:29 AM
  > You can come to my job. We scream at the top of our lungs in the shop every day

- **Planting4thefuture** (Score: 1) - 3/2/2025, 8:15:29 AM
  > Anywhere in dtla you’ll blend right in. On the fwy in your car is a good one I saw here lol.

- **Last-Cockroach-6218** (Score: 1) - 3/2/2025, 8:15:57 AM
  > as the economy gets worse and worse, and more and more people get laid off, and more and more SFH are bought by fintech,  more and more people will want places like this

- **momemata** (Score: 1) - 3/2/2025, 8:16:36 AM
  > I also tell my kid to scream and I scream with him, then apologize to my neighbors that he just needed to scream.

- **CampinHiker** (Score: 1) - 3/2/2025, 8:19:36 AM
  > Go on the side of PCH near LAX when the planes fly above you

- **Sarahclaire54** (Score: 1) - 3/2/2025, 8:19:42 AM
  > On the 405 in your car, at the top of your lungs. I have done it before!!!

- **sleepingovertires** (Score: 1) - 3/2/2025, 8:37:46 AM
  > On Lincoln in Venice Beach while naked on meth. 
  > 
  > I’ve seen it, so I know it’s a thing.

- **10k_Uzi** (Score: 1) - 3/2/2025, 8:41:46 AM
  > LA river dude

- **Heavy-Syrup-6195** (Score: 1) - 3/2/2025, 8:41:50 AM
  > Not sure if they’re still around, but there are places that allow you to rent a room full of random items that you can bash with your weapon of choice.

- **ThereCanOnlyBeOnce** (Score: 1) - 3/2/2025, 8:43:00 AM
  > maybe try a rage room

- **LaMelonBallz** (Score: 1) - 3/2/2025, 8:46:04 AM
  > Check out some of the rage rooms around the city, scream, yell, break things with a hammer, whatever you need to get it all out

- **Beginning-Cup4605** (Score: 1) - 3/2/2025, 8:47:43 AM
  > Check out the rage room in DTLA

- **_its_a_SWEATER_** (Score: 1) - 3/2/2025, 8:57:55 AM
  > Angeles Crest Hwy

- **Sharktomus** (Score: 1) - 3/2/2025, 9:39:20 AM
  > Magic Mountain or Knotts Berry Farm 

- **triaura** (Score: 1) - 3/2/2025, 10:32:16 AM
  > Muholland Drive

- **FPYHS** (Score: 1) - 3/2/2025, 10:52:32 AM
  > J

- **TheBear8878** (Score: 1) - 3/2/2025, 11:43:31 AM
  > Brother, it's LA. Just do it in the street at 9pm like all the other people around here

- **SanDiego_32** (Score: 1) - 3/2/2025, 8:00:35 AM
  > Skid Row

- **hampikatsov** (Score: 1) - 3/2/2025, 7:48:25 AM
  > Just go hiking somewhere in griffith park and when no ones around yeah do the deed

- **Prestigious-Cake-228** (Score: 1) - 3/2/2025, 7:51:30 AM
  > LAX

- **Ordinary_Resident_20** (Score: 1) - 3/2/2025, 7:56:35 AM
  > Scream into your towel in your car 🫶🏼

- **Rollins10** (Score: 1) - 3/2/2025, 7:59:00 AM
  > Fashion district

- **sha1dy** (Score: 1) - 3/2/2025, 7:59:04 AM
  > skid row

- **CosmicallyF-d** (Score: 1) - 3/2/2025, 8:00:39 AM
  > Well... I mean you wouldn't be unique doing so but anywhere in Santa Monica center. You're probably have a couple of screamers within a block of you.

- **EnlightenedIdiot1515** (Score: 1) - 3/2/2025, 8:03:45 AM
  > Any metro station, especially on the B line

- **PayFormer387** (Score: 1) - 3/2/2025, 8:07:50 AM
  > The Metro C line station at the 110 freeway. Or the Willowbrook/Rosa Parks station. Depends on the view you want.

- **awol_evan** (Score: 1) - 3/2/2025, 8:12:44 AM
  > Head to the beach if you can. Screaming into the vast blue has to be cathartic.

- **nodogbutdog** (Score: 1) - 3/2/2025, 8:13:16 AM
  > Sign up for a slotted open mic. Rant about your life and then step away from the mic and scream into the wall. You might get some laughs from comics.

- **rabidgoldenbear** (Score: 1) - 3/2/2025, 8:15:06 AM
  > The upper parking lot at Dodger Stadium while looking at the downtown skyline

- **PizzaHutBookItChamp** (Score: 1) - 3/2/2025, 8:15:20 AM
  > Cedar Grove in Griffith park is a really special spot overlooking the city. You can probably get in a couple of good screams there (more than a couple and people might call the cops?)
  > There are also some good spots up towards the Angeles Forest on the way to Switzer Falls. I believe there is a clearing off the side of the highway by the Clear Creek Fire Station. In the middle of nowhere. Good luck. 

- **soputmeonahighway** (Score: 1) - 3/2/2025, 8:19:47 AM
  > If you can’t find a lace to scream a big bucket of water balloons against a fence is super liberating, FYI!!! Best of Luck, let it RIP!!!!!

- **larrythegrobe** (Score: 1) - 3/2/2025, 8:21:01 AM
  > There are a number of musician practice rooms that you can rent around the city.

- **swdna** (Score: 1) - 3/2/2025, 8:24:59 AM
  > In your car! 😁

- **cranberrydudz** (Score: 1) - 3/2/2025, 8:25:06 AM
  > Downtown Los Angeles

- **EchoTrucha** (Score: 1) - 3/2/2025, 8:32:44 AM
  > Tujunga canyon

- **garyryan9** (Score: 1) - 3/2/2025, 8:33:43 AM
  > Message me I know all the lonely hiking spots lol

- **HambonesMcGee** (Score: 1) - 3/2/2025, 8:40:34 AM
  > I know some streets in Hollywood where this wouldn’t turn a single head

- **BroBeastDad** (Score: 1) - 3/2/2025, 8:49:40 AM
  > I do it in the shower lol I open my mouth and let water hit my mouth and fill up and then I start screaming lol works really good. OR! Under water that one hits THE BEST!

- **Over_Size_2611** (Score: 1) - 3/2/2025, 8:51:11 AM
  > Skid row. You’ll blend in with the crack heads.

- **TheObstruction** (Score: 1) - 3/2/2025, 8:53:46 AM
  > [I'm mad as Hell and I'm not going to take this anymore!](https://www.youtube.com/watch?v=_RujOFCHsxo)

- **Livexslow** (Score: 1) - 3/2/2025, 8:57:04 AM
  > literally any where😂 if any “normal” person is around they’ll just think you’re homeless and leave you alone

- **LynSukii** (Score: 1) - 3/2/2025, 8:59:27 AM
  > Like literally anywhere. Just do it.

- **Time_Medium_6622** (Score: 1) - 3/2/2025, 9:03:15 AM
  > Break room

- **astroboy7070** (Score: 1) - 3/2/2025, 9:05:54 AM
  > Beach

---

### Post 4: If I get to the Oscar’s red carpet early and sit outside will I see any celebrities?

**Author:** Smart-Story5388  
**Subreddit:** r/AskLosAngeles  
**Created:** 3/2/2025, 2:25:30 AM  
**Score:** 17 (68% upvoted)  
**Comments:** 44  
**URL:** [https://www.reddit.com/r/AskLosAngeles/comments/1j19jex/if_i_get_to_the_oscars_red_carpet_early_and_sit/](https://www.reddit.com/r/AskLosAngeles/comments/1j19jex/if_i_get_to_the_oscars_red_carpet_early_and_sit/)  

**Content:**

> If I get to the Oscar’s red carpet early and sit outside will I see any celebrities? 

#### Comments:

- **AutoModerator** (Score: 1) - 3/2/2025, 2:25:30 AM
  > This is an automated message that is applied to every post. Just a general reminder, /r/AskLosAngeles is a friendly question and answer subreddit for the region of Los Angeles, California. Please follow [the subreddit rules](/r/AskLosAngeles/about/rules/), report content that does not follow rules, and feel empowered to contribute to the [subreddit wiki](https://www.reddit.com/r/AskLosAngeles/wiki/) or to ask questions of your fellow community members. The vibe should be helpful and friendly and the quality of your contribution makes a difference. Unhelpful comments are discouraged, rude interactions are bannable.
  > 
  > *I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](/message/compose/?to=/r/AskLosAngeles) if you have any questions or concerns.*

- **Goodbyecandy** (Score: 48) - 3/2/2025, 2:55:49 AM
  > 1iota gives free tickets to red carpets fyi

  - **chaseribarelyknowher** (Score: 1) - 3/2/2025, 9:45:06 AM
    > Still? I feel like everytime I’ve checked over the past 1-2 years it’s been pretty dry.

    - **Goodbyecandy** (Score: 1) - 3/2/2025, 9:50:21 AM
      > I’ve been pretty lucky with them. I was able to see Gwen Stefani last year at jimmy Kimmel. I still get their email invites, even for red carpets events and movie premiers, but I’ve never requested those kind of tickets. I’ve also seen Beck and John Waters through 1iota couple years back

- **qabalist** (Score: 22) - 3/2/2025, 3:05:43 AM
  > you'll need a telephoto lens, but maybe. I tried once and there are grandstands and signs and a million other people with the same idea. but maybe if you want to sleep outside a day or two....you may be able to win tickets for the grandstand, so it's not impossible, but difficult.

  - **Smart-Story5388** (Score: 2) - 3/2/2025, 3:27:06 AM
    > Very helpful answer! Do you think I’ll be able to see anything with a telephoto? I have a 100-500

    - **Dazzling_Pink9751** (Score: 2) - 3/2/2025, 6:38:04 AM
      > Next year sign up for the lottery. They do one where you can sit in the stands inside for fans. If you really want to see Celebrities, pay attention to the Hollywood premieres around the city. Go to a big one and you will see tons of stars not in the movie.

- **Big_Neat_3711** (Score: 13) - 3/2/2025, 2:34:03 AM
  > All I saw was a sea of black SUVs.

- **ILoveLipGloss** (Score: 71) - 3/2/2025, 2:32:29 AM
  > maybe you'll see homeless spiderman &amp; washed up wonder woman

  - **CurrentPianist9812** (Score: 3) - 3/2/2025, 3:03:09 AM
    > Is that the crazy older woman with red hair that wears a Wonder Woman costume and rides around on a Harley?

  - **GetsMeEveryTimeBot** (Score: 1) - 3/2/2025, 3:37:42 AM
    > And Tall Jesus, horning into the photos.

    - **cmmedit** (Score: 2) - 3/2/2025, 4:39:34 AM
      > I should've taken a pic the time I was walking down hollywood wearing a buddha t-shirt while strolling behind tall Jesus as he walked into the liquor store.

- **Bubzszs** (Score: 9) - 3/2/2025, 2:39:05 AM
  > You'll definitely see mickey mouse with his powder blue suit and hat

- **Wonderful_Milk1176** (Score: 6) - 3/2/2025, 4:29:01 AM
  > Maybe for like two seconds. Limo drops are at Hollywood and Highland but it turns into a militarized zone with nearly zero access or visibility.

- **Commercial_Sir_3205** (Score: 10) - 3/2/2025, 4:34:04 AM
  > Hang outside of Gold's Gym Venice and you'll see several celebrities and athletes. Just pay lots of attention because without makeup they look like regular people and you won't notice them.

- **turdvonnegut** (Score: 4) - 3/2/2025, 4:35:31 AM
  > All the streets will be closed, so no.

- **MotorAcanthisitta575** (Score: 7) - 3/2/2025, 5:50:04 AM
  > lol why would anyone do this

- **Alarming_Grand6946** (Score: 3) - 3/2/2025, 4:39:21 AM
  > I believe it’s closed off now to the public 

  - **tatobuckets** (Score: 1) - 3/2/2025, 6:14:42 AM
    > Yup, there’s a giant 4 sided tent covering the red carpet and the entire front of the Dolby on Hollywood Blvd.

- **DKToTheFuture** (Score: 3) - 3/2/2025, 6:47:16 AM
  > Watch TV. You’ll see em all.

- **einsteinGO** (Score: 5) - 3/2/2025, 2:38:41 AM
  > I can only imagine this would be fun if you can walk there

  - **Area51_Spurs** (Score: 7) - 3/2/2025, 5:44:10 AM
    > I can tell you as someone who worked the red carpets for all these events AND as someone who lived nearby later on, seeing it from both sides, there is nothing fun about it. 
    > 
    > It’s a bunch of parasocial weirdo creepy freaks, many of which are WAYYY too told to be acting like that and you aren’t even going to get any decent view of anything. 
    > 
    > I can’t understand people who are more interested in the fashion looks and stuff and how that would be something people would want to see that’s not really unhealthy. 
    > 
    > But the people who go down there are mostly weirdo stalker delusional super fans. 
    > 
    > And again you’re not really going to get a look at much of anything from afar usually. 
    > 
    > Also you will see “red carpet” Oscar events and parties you can buy tickets for. Those are scams. Those are not the actual parties any of the celebs go to or anything like the Vanity Fair party and shit. And even then most of the A-Listers aren’t out partying all night or anything and the ones that are there and the winners that are at the parties are usually producers and random other folks in the industry. 
    > 
    > You’d have better luck celeb spotting at an in n out nearby after the show. 
    > 
    > But if you want to know the inside scoop, the Golden Globes are the fun award show and after party. They serve drinks during the show and no actors take it seriously and people actually have fun at the globes. That’s what you want to finagle your way into. Oscars are stuffy and people are stressed and it’s not very fun.

    - **Dazzling_Pink9751** (Score: 2) - 3/2/2025, 6:44:52 AM
      > The best way is to go to premieres. You can meet tons of celebrities. Also, film festivals like Sundance. I know that is in Utah, but it’s where to meet them. Jimmy Kimmel also has a place in the back of his filming location, where fans can meet celebrities.

  - **emmmily257** (Score: 9) - 3/2/2025, 3:27:34 AM
    > Having lived on Cahuenga a few years ago I can confirm - it’s was mildly interesting to walk past random celebrity events on my way to Trader Joe’s or the train station, but you’re most likely not gonna see anyone famous

- **SolidGoldKoala666** (Score: 6) - 3/2/2025, 2:30:16 AM
  > nah they’re at the pink’s on la brea

- **hundrethtimesacharm** (Score: 2) - 3/2/2025, 5:04:19 AM
  > Probably. I just saw Mika Kunis at Target. It’s LA.

- **HaroldWeigh** (Score: 1) - 3/2/2025, 7:21:47 AM
  > Outside of The Wallis in Beverly Hills for the Vanity Fair party is a better bet.

- **SkullLeader** (Score: 1) - 3/2/2025, 7:24:02 AM
  > They have grandstand seats but you'd need tickets in advance though I think they are free I am sure they don't have any left by this point.  But maybe something to think about for next year.
  > 
  > I showed up once when it was already underway, caught a few glimpses but like behind a barricade and about 10 rows of people in front of me so literally just glimpses.  IMHO if you want to see celebrities there are better ways.

- **XandersOdyssey** (Score: 1) - 3/2/2025, 9:41:06 AM
  > No

- **CivilJerk** (Score: 1) - 3/2/2025, 11:27:00 AM
  > Dress nice and hang out at the bar at the Hollywood Roosevelt hotel across the street.

- **lubeinatube** (Score: 4) - 3/2/2025, 5:10:47 AM
  > Do people get off on just witnessing a celebrity?

  - **SimplyRoya** (Score: 1) - 3/2/2025, 6:05:23 AM
    > Some people are weird lol. I see them and don’t care.

  - **Dazzling_Pink9751** (Score: 0) - 3/2/2025, 6:36:27 AM
    > I have stood less than two feet from Bruno mars and 5 feet from Ariana Grande. I have also met Johnny Depp. I would rather meet them and get an autograph or picture. Just seeing them, isn’t that much fun.

    - **lubeinatube** (Score: 0) - 3/2/2025, 6:53:21 AM
      > I have no idea who Venice been close to, because I don’t even know what those people look like 🤷🏽‍♂️

      - **Dazzling_Pink9751** (Score: 1) - 3/2/2025, 7:00:06 AM
        > Why are you on this post, if you don’t care about celebrities?

        - **lubeinatube** (Score: 1) - 3/2/2025, 7:08:24 AM
          > Because I was asking why people are so keen on witnessing them.

          - **Dazzling_Pink9751** (Score: 1) - 3/2/2025, 7:31:16 AM
            > Everyone has different interests. You can skip anything that doesn’t interest you.

            - **lubeinatube** (Score: 1) - 3/2/2025, 7:40:49 AM
              > Believe me dude, I’m hiding pages like a mofo, they just keep coming

- **Aeriellie** (Score: 1) - 3/2/2025, 5:27:42 AM
  > no, it’s usually all blocked off with a fence covered in black fabric.

- **SimplyRoya** (Score: 1) - 3/2/2025, 6:05:00 AM
  > It’s all blocked off and you need to be invited.

- **vannendave** (Score: 1) - 3/2/2025, 6:12:17 AM
  > No

- **RecommendationBig768** (Score: 1) - 3/2/2025, 8:33:22 AM
  > security guards prevents average citizens from getting too close. only persons that get up real close are the press and the celebrities attending the event. there are bleachers set up for fans, but they are set farther back from the red carpet.  also the limousines tend to block the fans view

- **_DirtyYoungMan_** (Score: 0) - 3/2/2025, 5:56:28 AM
  > No, celebrities don't go to the Oscars.

- **RedditorsGetChills** (Score: 0) - 3/2/2025, 6:40:38 AM
  > I went with a friend from out of state who wanted to stream it, and the best we got was across the street from the location, and we were able to see people from quite far away. Rihanna apparently looked at our area and people lost it, but I wasn't paying attention at that time.
  > 
  > 
  > After that we did run into the "Bill Clinton kid" Matan who I think was trying to sneak in. 

---

### Post 5: If I get to the Oscar’s red carpet early and sit outside will I see any celebrities?

**Author:** Smart-Story5388  
**Subreddit:** r/AskLosAngeles  
**Created:** 3/2/2025, 2:25:30 AM  
**Score:** 16 (67% upvoted)  
**Comments:** 44  
**URL:** [https://www.reddit.com/r/AskLosAngeles/comments/1j19jex/if_i_get_to_the_oscars_red_carpet_early_and_sit/](https://www.reddit.com/r/AskLosAngeles/comments/1j19jex/if_i_get_to_the_oscars_red_carpet_early_and_sit/)  

**Content:**

> If I get to the Oscar’s red carpet early and sit outside will I see any celebrities? 

#### Comments:

- **AutoModerator** (Score: 1) - 3/2/2025, 2:25:30 AM
  > This is an automated message that is applied to every post. Just a general reminder, /r/AskLosAngeles is a friendly question and answer subreddit for the region of Los Angeles, California. Please follow [the subreddit rules](/r/AskLosAngeles/about/rules/), report content that does not follow rules, and feel empowered to contribute to the [subreddit wiki](https://www.reddit.com/r/AskLosAngeles/wiki/) or to ask questions of your fellow community members. The vibe should be helpful and friendly and the quality of your contribution makes a difference. Unhelpful comments are discouraged, rude interactions are bannable.
  > 
  > *I am a bot, and this action was performed automatically. Please [contact the moderators of this subreddit](/message/compose/?to=/r/AskLosAngeles) if you have any questions or concerns.*

- **Goodbyecandy** (Score: 48) - 3/2/2025, 2:55:49 AM
  > 1iota gives free tickets to red carpets fyi

  - **chaseribarelyknowher** (Score: 1) - 3/2/2025, 9:45:06 AM
    > Still? I feel like everytime I’ve checked over the past 1-2 years it’s been pretty dry.

    - **Goodbyecandy** (Score: 1) - 3/2/2025, 9:50:21 AM
      > I’ve been pretty lucky with them. I was able to see Gwen Stefani last year at jimmy Kimmel. I still get their email invites, even for red carpets events and movie premiers, but I’ve never requested those kind of tickets. I’ve also seen Beck and John Waters through 1iota couple years back

- **qabalist** (Score: 20) - 3/2/2025, 3:05:43 AM
  > you'll need a telephoto lens, but maybe. I tried once and there are grandstands and signs and a million other people with the same idea. but maybe if you want to sleep outside a day or two....you may be able to win tickets for the grandstand, so it's not impossible, but difficult.

  - **Smart-Story5388** (Score: 2) - 3/2/2025, 3:27:06 AM
    > Very helpful answer! Do you think I’ll be able to see anything with a telephoto? I have a 100-500

    - **Dazzling_Pink9751** (Score: 2) - 3/2/2025, 6:38:04 AM
      > Next year sign up for the lottery. They do one where you can sit in the stands inside for fans. If you really want to see Celebrities, pay attention to the Hollywood premieres around the city. Go to a big one and you will see tons of stars not in the movie.

- **Big_Neat_3711** (Score: 13) - 3/2/2025, 2:34:03 AM
  > All I saw was a sea of black SUVs.

- **ILoveLipGloss** (Score: 71) - 3/2/2025, 2:32:29 AM
  > maybe you'll see homeless spiderman &amp; washed up wonder woman

  - **CurrentPianist9812** (Score: 3) - 3/2/2025, 3:03:09 AM
    > Is that the crazy older woman with red hair that wears a Wonder Woman costume and rides around on a Harley?

  - **GetsMeEveryTimeBot** (Score: 1) - 3/2/2025, 3:37:42 AM
    > And Tall Jesus, horning into the photos.

    - **cmmedit** (Score: 2) - 3/2/2025, 4:39:34 AM
      > I should've taken a pic the time I was walking down hollywood wearing a buddha t-shirt while strolling behind tall Jesus as he walked into the liquor store.

- **Bubzszs** (Score: 10) - 3/2/2025, 2:39:05 AM
  > You'll definitely see mickey mouse with his powder blue suit and hat

- **Wonderful_Milk1176** (Score: 7) - 3/2/2025, 4:29:01 AM
  > Maybe for like two seconds. Limo drops are at Hollywood and Highland but it turns into a militarized zone with nearly zero access or visibility.

- **Commercial_Sir_3205** (Score: 10) - 3/2/2025, 4:34:04 AM
  > Hang outside of Gold's Gym Venice and you'll see several celebrities and athletes. Just pay lots of attention because without makeup they look like regular people and you won't notice them.

- **turdvonnegut** (Score: 5) - 3/2/2025, 4:35:31 AM
  > All the streets will be closed, so no.

- **MotorAcanthisitta575** (Score: 7) - 3/2/2025, 5:50:04 AM
  > lol why would anyone do this

- **Alarming_Grand6946** (Score: 3) - 3/2/2025, 4:39:21 AM
  > I believe it’s closed off now to the public 

  - **tatobuckets** (Score: 1) - 3/2/2025, 6:14:42 AM
    > Yup, there’s a giant 4 sided tent covering the red carpet and the entire front of the Dolby on Hollywood Blvd.

- **DKToTheFuture** (Score: 3) - 3/2/2025, 6:47:16 AM
  > Watch TV. You’ll see em all.

- **einsteinGO** (Score: 5) - 3/2/2025, 2:38:41 AM
  > I can only imagine this would be fun if you can walk there

  - **Area51_Spurs** (Score: 6) - 3/2/2025, 5:44:10 AM
    > I can tell you as someone who worked the red carpets for all these events AND as someone who lived nearby later on, seeing it from both sides, there is nothing fun about it. 
    > 
    > It’s a bunch of parasocial weirdo creepy freaks, many of which are WAYYY too told to be acting like that and you aren’t even going to get any decent view of anything. 
    > 
    > I can’t understand people who are more interested in the fashion looks and stuff and how that would be something people would want to see that’s not really unhealthy. 
    > 
    > But the people who go down there are mostly weirdo stalker delusional super fans. 
    > 
    > And again you’re not really going to get a look at much of anything from afar usually. 
    > 
    > Also you will see “red carpet” Oscar events and parties you can buy tickets for. Those are scams. Those are not the actual parties any of the celebs go to or anything like the Vanity Fair party and shit. And even then most of the A-Listers aren’t out partying all night or anything and the ones that are there and the winners that are at the parties are usually producers and random other folks in the industry. 
    > 
    > You’d have better luck celeb spotting at an in n out nearby after the show. 
    > 
    > But if you want to know the inside scoop, the Golden Globes are the fun award show and after party. They serve drinks during the show and no actors take it seriously and people actually have fun at the globes. That’s what you want to finagle your way into. Oscars are stuffy and people are stressed and it’s not very fun.

    - **Dazzling_Pink9751** (Score: 2) - 3/2/2025, 6:44:52 AM
      > The best way is to go to premieres. You can meet tons of celebrities. Also, film festivals like Sundance. I know that is in Utah, but it’s where to meet them. Jimmy Kimmel also has a place in the back of his filming location, where fans can meet celebrities.

  - **emmmily257** (Score: 9) - 3/2/2025, 3:27:34 AM
    > Having lived on Cahuenga a few years ago I can confirm - it’s was mildly interesting to walk past random celebrity events on my way to Trader Joe’s or the train station, but you’re most likely not gonna see anyone famous

- **SolidGoldKoala666** (Score: 6) - 3/2/2025, 2:30:16 AM
  > nah they’re at the pink’s on la brea

- **hundrethtimesacharm** (Score: 2) - 3/2/2025, 5:04:19 AM
  > Probably. I just saw Mika Kunis at Target. It’s LA.

- **HaroldWeigh** (Score: 1) - 3/2/2025, 7:21:47 AM
  > Outside of The Wallis in Beverly Hills for the Vanity Fair party is a better bet.

- **SkullLeader** (Score: 1) - 3/2/2025, 7:24:02 AM
  > They have grandstand seats but you'd need tickets in advance though I think they are free I am sure they don't have any left by this point.  But maybe something to think about for next year.
  > 
  > I showed up once when it was already underway, caught a few glimpses but like behind a barricade and about 10 rows of people in front of me so literally just glimpses.  IMHO if you want to see celebrities there are better ways.

- **XandersOdyssey** (Score: 1) - 3/2/2025, 9:41:06 AM
  > No

- **CivilJerk** (Score: 1) - 3/2/2025, 11:27:00 AM
  > Dress nice and hang out at the bar at the Hollywood Roosevelt hotel across the street.

- **lubeinatube** (Score: 3) - 3/2/2025, 5:10:47 AM
  > Do people get off on just witnessing a celebrity?

  - **SimplyRoya** (Score: 1) - 3/2/2025, 6:05:23 AM
    > Some people are weird lol. I see them and don’t care.

  - **Dazzling_Pink9751** (Score: 0) - 3/2/2025, 6:36:27 AM
    > I have stood less than two feet from Bruno mars and 5 feet from Ariana Grande. I have also met Johnny Depp. I would rather meet them and get an autograph or picture. Just seeing them, isn’t that much fun.

    - **lubeinatube** (Score: 0) - 3/2/2025, 6:53:21 AM
      > I have no idea who Venice been close to, because I don’t even know what those people look like 🤷🏽‍♂️

      - **Dazzling_Pink9751** (Score: 1) - 3/2/2025, 7:00:06 AM
        > Why are you on this post, if you don’t care about celebrities?

        - **lubeinatube** (Score: 1) - 3/2/2025, 7:08:24 AM
          > Because I was asking why people are so keen on witnessing them.

          - **Dazzling_Pink9751** (Score: 1) - 3/2/2025, 7:31:16 AM
            > Everyone has different interests. You can skip anything that doesn’t interest you.

            - **lubeinatube** (Score: 1) - 3/2/2025, 7:40:49 AM
              > Believe me dude, I’m hiding pages like a mofo, they just keep coming

- **Aeriellie** (Score: 1) - 3/2/2025, 5:27:42 AM
  > no, it’s usually all blocked off with a fence covered in black fabric.

- **SimplyRoya** (Score: 1) - 3/2/2025, 6:05:00 AM
  > It’s all blocked off and you need to be invited.

- **vannendave** (Score: 1) - 3/2/2025, 6:12:17 AM
  > No

- **RecommendationBig768** (Score: 1) - 3/2/2025, 8:33:22 AM
  > security guards prevents average citizens from getting too close. only persons that get up real close are the press and the celebrities attending the event. there are bleachers set up for fans, but they are set farther back from the red carpet.  also the limousines tend to block the fans view

- **_DirtyYoungMan_** (Score: 0) - 3/2/2025, 5:56:28 AM
  > No, celebrities don't go to the Oscars.

- **RedditorsGetChills** (Score: 0) - 3/2/2025, 6:40:38 AM
  > I went with a friend from out of state who wanted to stream it, and the best we got was across the street from the location, and we were able to see people from quite far away. Rihanna apparently looked at our area and people lost it, but I wasn't paying attention at that time.
  > 
  > 
  > After that we did run into the "Bill Clinton kid" Matan who I think was trying to sneak in. 

---

