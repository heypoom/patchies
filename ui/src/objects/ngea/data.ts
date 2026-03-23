export type NgeaGong = {
  id: string;

  freq: number;

  /** f1 / f2 */
  dividedFreq: number;

  cents: number;
  accumulate: number;

  overtone?: number | null;
  overtoneI?: number | null;
  overtoneII?: number | null;
};

export type NgeaTuning = {
  title: string;
  contributor: string;
  shortDesc: string;
  location: string;
  desc: string;
  source: string | { title: string; src: string };
  images: string[];
  data: NgeaGong[];
};

/**
 * Data sources taken from
 * https://networkgongensemblearchive.online
 *
 * With permission from the original author, Elekhlekha.
 * Project authors: Kengchakaj Kengkarnka and Nitcha Tothong.
 *
 * Source Licensing: CC Attribution - ShareAlike (CC BY-SA)
 * https://creativecommons.org/licenses/by-sa/4.0/
 *
 * Any scraping, indexing, or use of this content for
 * training artificial intelligence systems or machine
 * learning models is expressly prohibited without
 * express written permission to the original author.
 */
export const NGEA_TUNINGS: NgeaTuning[] = [
  {
    title: 'Khong Wong Yai',
    contributor: 'elekhlekha',
    shortDesc:
      'Khong Wong Yai Luang Pradit Phairoh ฆ้องวงใหญ่ หลวงประดิษฐไพเราะ ฆ้องวงใหญ่ หลวงประดิษฐไพเราะ',
    location: 'Thailand',
    desc: 'The Khong Wong Yai ฆ้องวงใหญ่ is an instrument with 16 tuned gongs commonly found in the traditional Thai Piphat ensemble.\n\nThe Khong Wong Yai has the role of carrying the main melody of the composition in the Piphat ensemble.\n\nThis sound culture data set of Khong Wong Yai ฆ้องวงใหญ่ is passed down aurally from Luang Pradit Phairoh หลวงประดิษฐไพเราะ lineage.\n\n',
    source: {
      title: 'มือฆ้องท่านครู 094 | พากย์สาม มือ 32 (แบบที่ 1)',
      src: 'https://www.youtube.com/watch?v=CiykKJ7M3gY'
    },
    images: [],
    data: [
      {
        id: '#1',
        freq: 281.4,
        dividedFreq: 0,
        cents: 0,
        accumulate: 0
      },
      {
        id: '#2',
        freq: 312,
        dividedFreq: 1.108742004,
        cents: 178.7084406,
        accumulate: 178.7084406
      },
      {
        id: '#3',
        freq: 342.9,
        dividedFreq: 1.099038462,
        cents: 163.4902502,
        accumulate: 342.1986908
      },
      {
        id: '#4',
        freq: 381.2,
        dividedFreq: 1.111694372,
        cents: 183.312258,
        accumulate: 525.5109488
      },
      {
        id: '#5',
        freq: 418.9,
        dividedFreq: 1.098898216,
        cents: 163.2693179,
        accumulate: 688.7802668
      },
      {
        id: '#6',
        freq: 461.9,
        dividedFreq: 1.102649797,
        cents: 169.1695944,
        accumulate: 857.9498611
      },
      {
        id: '#7',
        freq: 510,
        dividedFreq: 1.104135094,
        cents: 171.5000411,
        accumulate: 1029.449902
      },
      {
        id: '#8',
        freq: 564,
        dividedFreq: 1.105882353,
        cents: 174.2374986,
        accumulate: 1203.687401
      },
      {
        id: '#9',
        freq: 620,
        dividedFreq: 1.09929078,
        cents: 163.8876635,
        accumulate: 1367.575064
      },
      {
        id: '#10',
        freq: 684.3,
        dividedFreq: 1.103709677,
        cents: 170.8328782,
        accumulate: 1538.407943
      },
      {
        id: '#11',
        freq: 756.8,
        dividedFreq: 1.105947684,
        cents: 174.3397696,
        accumulate: 1712.747712
      },
      {
        id: '#12',
        freq: 835,
        dividedFreq: 1.10332981,
        cents: 170.2369307,
        accumulate: 1882.984643
      },
      {
        id: '#13',
        freq: 919.8,
        dividedFreq: 1.101556886,
        cents: 167.4528002,
        accumulate: 2050.437443
      },
      {
        id: '#14',
        freq: 1018,
        dividedFreq: 1.10676234,
        cents: 175.6145503,
        accumulate: 2226.051993
      },
      {
        id: '#15',
        freq: 1124,
        dividedFreq: 1.104125737,
        cents: 171.485369,
        accumulate: 2397.537362
      },
      {
        id: '#16',
        freq: 1241,
        dividedFreq: 1.104092527,
        cents: 171.4332959,
        accumulate: 2568.970658
      }
    ]
  },
  {
    title: 'Khong Wong Yai - Sorawat Ruangamporn',
    shortDesc: '',
    contributor: 'Sorawat Ruangamporn',
    location: 'New Jersey',
    desc: "Sorawat Ruangamporn is a Chulalongkorn University graduate who majored in Traditional Thai Music Pedagogy. His primary instrument is the Khong Wong Yai, which he began learning at age 10 through his school's after-school traditional Thai music club. Unlike most traditional Thai music practitioners who grow up in cultural bearer households where the art form is passed down through generations, Sorawat was drawn to the music purely through passion and the joy he experienced while practicing. He considers himself fortunate not to have grown up in such a traditional household, as this allowed him to approach the music from a fresh perspective and blend traditional elements with contemporary approaches.\n\nAfter graduating from university, Sorawat joined a program that sent traditional Thai music teachers to the United States to instruct students at Thai temples in Los Angeles, Chicago, and New York. During this time, he fell in love with New York's theater scene and realized that it was possible to build a serious, sustainable career in the performing arts—something he hadn't believed was feasible based on his experience in Thailand.\n\nFollowing his year of teaching Thai music in the US, Sorawat decided to pursue a Master's degree in Communication Art Studies. After graduation, he entered the traditional workforce while continuing to teach traditional Thai music on the side, dedicated to passing down Thai cultural identity to American-born Thai students.\n\nSorawat chose to specialize in the Khong Wong Yai because this instrument carries the main melody while other instruments in the ensemble play improvised lines over the foundation it provides. He believes the Khong Wong Yai takes on this responsibility of playing the main melody due to the nature of its brass material, which resonates powerfully and carries throughout the ensemble, providing a solid foundation that suits the horizontal structure characteristic of traditional Thai music. He views the Khong Wong Yai as the \"film director\" of the band—serving as the anchor that guides and unifies the entire ensemble.\n\nHistorically, traditional Thai music has served as a means of communication with deities and ancestors, with specific compositions created to accompany various activities and rituals. However, Sorawat observes that in contemporary times, this functional aspect of the music is diminishing. The decline stems from two interconnected factors: the gradual loss of traditional knowledge and the dwindling number of practitioners who understand which songs correspond to specific activities or ceremonies.\nDespite this challenge, Sorawat advocates for a pragmatic approach to cultural preservation. In his view, it is better to maintain the practice of traditional music—even when practitioners may not know the most appropriate song for a particular activity—rather than allowing the tradition to cease entirely. He sees this as a necessary compromise: keeping the music alive and functional, albeit imperfectly, ensures its continuity for future generations who may be able to evolve its function to reflect contemporary times.\n      ",
    source: {
      title: 'Khong Wong Yai - Sorawat Ruangamporn',
      src: 'https://www.dropbox.com/scl/fo/o8f28dd8u1xlrtxxxv475/ANzB8fgSwaZXQrJ2PDlms-Y?rlkey=r7kovsfsq39q40i2npilw4a2v&e=1&dl=0'
    },
    images: [],
    data: [
      {
        id: '#1',
        freq: 291.8,
        overtone: 496.7,
        dividedFreq: 0,
        cents: 0,
        accumulate: 0
      },
      {
        id: '#2',
        freq: 323,
        overtone: 562.5,
        dividedFreq: 1.10692255,
        cents: 175.865138,
        accumulate: 175.865138
      },
      {
        id: '#3',
        freq: 347.2,
        overtone: 590.2,
        dividedFreq: 1.074922601,
        cents: 125.0793394,
        accumulate: 300.9444774
      },
      {
        id: '#4',
        freq: 385.1,
        overtone: 735.7,
        dividedFreq: 1.109158986,
        cents: 179.3594104,
        accumulate: 480.3038879
      },
      {
        id: '#5',
        freq: 446.4,
        overtone: 867.6,
        dividedFreq: 1.159179434,
        cents: 255.7246848,
        accumulate: 736.0285727
      },
      {
        id: '#6',
        freq: 477.1,
        overtone: 834.925,
        dividedFreq: 1.068772401,
        cents: 115.145591,
        accumulate: 851.1741637
      },
      {
        id: '#7',
        freq: 520,
        overtone: 910,
        dividedFreq: 1.089918256,
        cents: 149.0639243,
        accumulate: 1000.238088
      },
      {
        id: '#8',
        freq: 592.5,
        overtone: 1036.875,
        dividedFreq: 1.139423077,
        cents: 225.9642369,
        accumulate: 1226.202325
      },
      {
        id: '#9',
        freq: 648,
        overtone: 1134,
        dividedFreq: 1.093670886,
        cents: 155.0143909,
        accumulate: 1381.216716
      },
      {
        id: '#10',
        freq: 708.6,
        overtone: 1240.05,
        dividedFreq: 1.093518519,
        cents: 154.7731828,
        accumulate: 1535.989899
      },
      {
        id: '#11',
        freq: 779.5,
        overtone: 1364.125,
        dividedFreq: 1.100056449,
        cents: 165.093069,
        accumulate: 1701.082968
      },
      {
        id: '#12',
        freq: 869.9,
        overtone: 1522.325,
        dividedFreq: 1.115971777,
        cents: 189.9606498,
        accumulate: 1891.043617
      },
      {
        id: '#13',
        freq: 940.5,
        overtone: 1645.875,
        dividedFreq: 1.081158754,
        cents: 135.0940552,
        accumulate: 2026.137673
      },
      {
        id: '#14',
        freq: 1056,
        overtone: 1848,
        dividedFreq: 1.122807018,
        cents: 200.531983,
        accumulate: 2226.669656
      },
      {
        id: '#15',
        freq: 1167,
        overtone: 2042.25,
        dividedFreq: 1.105113636,
        cents: 173.0336716,
        accumulate: 2399.703327
      },
      {
        id: '#16',
        freq: 1292,
        overtone: 2261,
        dividedFreq: 1.107112254,
        cents: 176.1618108,
        accumulate: 2575.865138
      }
    ]
  },
  {
    title: 'Khmer Kong Von Thom',
    contributor: 'High Alter (Lynn Nandar Htoo)',
    shortDesc: 'From Irrawaddy to Mekong: Sound Migrations – Khmer Kong Von Thom',
    location: 'Cambodia',
    desc: "\n      Growing up immersed in Buddhist culture, I have always known the gong as a sacred instrument—from the grand gongs of pagodas to the small household gongs used for အမျှဝေ, the practice of spreading good deeds through sound. Now, working in Cambodia and recording traditional musicians, I find myself caught between familiarity and homesickness. The Cambodian gongs resonate with something deeply recognizable, yet each strike reminds me of Myanmar, a country currently in turmoil, where I cannot return.\n\nWhat fascinate me most is a particular paradox I've seen day to day: the aunties in Myanmar who mindfully strike their gongs in the morning, sharing merit and spreading peace through sound, only to find themselves shouting and fighting with family members by evening. I mention this not with judgment but with profound understanding. When daily life brings constant struggle, these women embody the human condition: aspiring toward peace while being ground down by circumstances beyond their control.\n\nYet the gong's purpose remains unchanged. In both Myanmar and Cambodia, the moment when the gong sounds creates a space of presence and clarity. It may last only seconds as the bronze vibrations fade, but in that moment, something shifts. This brief sonic opening becomes even more vital.\n\nThe kong vong , the circular gong chime I've been documenting, is a traditional Cambodian circular gong chime, a kong vong toch (small/high-pitched version) with five bronze gongs suspended vertically in a rattan frame. Each gong features a raised central boss that musicians strike with padded mallets to produce melodic tones, with precise tuning achieved through a traditional mixture of beeswax, lead, and rice husks applied to the interior. The instrument is adorned with colorful tiered cloth decorations in yellow, green, and red - traditional Cambodian colors - at its base. Musicians sit within the center of the circular frame and move around the arc striking different gongs to create flowing melodic patterns that support and embellish the lead xylophone in the classical pinpeat ensemble. This instrument represents over a thousand years of Cambodian musical tradition, with similar gong chimes depicted on the walls of Angkor Wat and other ancient temples. The workshop setting suggests this is part of crucial preservation efforts to revive traditional instrument-making techniques that were nearly lost during the Khmer Rouge period. These circular gong chimes serve as both melodic instruments in court music and sacred objects connecting earthly performances with spiritual realms in Cambodian cosmology.\nCambodia's kong vong toch carries its own story of survival. Nearly destroyed during the Khmer Rouge period, these instruments were preserved by musicians who refused to let their traditions die. Like Myanmar, Cambodia has endured profound political trauma, and like Myanmar, it has kept these sacred sounds alive.\n\nBoth countries understand that tradition persists not when life is easy, but when it becomes essential—when the sound of a gong offers the only moment of peace available in an otherwise chaotic day.\n\nRecording Detail\nDate: September 19, 2025\nPlace: Phnom Penh, Cambodia\nRecorded with Zoom H8\n      ",
    source: {
      title: 'Khmer Kong Von Thom',
      src: 'https://www.dropbox.com/scl/fi/3s2cyg18k6p5i7i0cp2kr/Khmer-Khom-Von-Thong.wav?rlkey=p8o2kvtqbftexsogepcnc5ahj&dl=0'
    },
    images: [],
    data: [
      {
        id: '#1',
        freq: 295,
        overtone: 535.7,
        dividedFreq: 0,
        cents: 0,
        accumulate: 0
      },
      {
        id: '#2',
        freq: 323.8,
        overtone: 589.7,
        dividedFreq: 1.097627119,
        cents: 161.2656374,
        accumulate: 161.2656374
      },
      {
        id: '#3',
        freq: 354.5,
        overtone: 670.8,
        dividedFreq: 1.094811612,
        cents: 156.8191702,
        accumulate: 318.0848076
      },
      {
        id: '#4',
        freq: 395.6,
        overtone: null,
        dividedFreq: 1.115937941,
        cents: 189.9081584,
        accumulate: 507.9929659
      },
      {
        id: '#5',
        freq: 440,
        overtone: null,
        dividedFreq: 1.11223458,
        cents: 184.1533172,
        accumulate: 692.1462831
      },
      {
        id: '#6',
        freq: 484.2,
        overtone: null,
        dividedFreq: 1.100454545,
        cents: 165.7194667,
        accumulate: 857.8657498
      },
      {
        id: '#7',
        freq: 532.4,
        overtone: 990.6,
        dividedFreq: 1.099545642,
        cents: 164.2889903,
        accumulate: 1022.15474
      },
      {
        id: '#8',
        freq: 587.3,
        overtone: 1050,
        dividedFreq: 1.103117956,
        cents: 169.9044799,
        accumulate: 1192.05922
      },
      {
        id: '#9',
        freq: 657.4,
        overtone: 1185,
        dividedFreq: 1.119359782,
        cents: 195.2085823,
        accumulate: 1387.267802
      },
      {
        id: '#10',
        freq: 710.3,
        overtone: 1245,
        dividedFreq: 1.080468512,
        cents: 133.9884347,
        accumulate: 1521.256237
      },
      {
        id: '#11',
        freq: 790.8,
        overtone: 1458,
        dividedFreq: 1.113332395,
        cents: 185.8612629,
        accumulate: 1707.1175
      },
      {
        id: '#12',
        freq: 891.2,
        overtone: 1583,
        dividedFreq: 1.12696004,
        cents: 206.9236339,
        accumulate: 1914.041134
      },
      {
        id: '#13',
        freq: 969.1,
        overtone: 1843,
        dividedFreq: 1.087410233,
        cents: 145.0755723,
        accumulate: 2059.116706
      },
      {
        id: '#14',
        freq: 1060,
        overtone: 1860,
        dividedFreq: 1.09379837,
        cents: 155.2161801,
        accumulate: 2214.332886
      },
      {
        id: '#15',
        freq: 1164,
        overtone: null,
        dividedFreq: 1.098113208,
        cents: 162.0321521,
        accumulate: 2376.365038
      },
      {
        id: '#16',
        freq: 1296,
        overtone: null,
        dividedFreq: 1.113402062,
        cents: 185.969592,
        accumulate: 2562.33463
      }
    ]
  },
  {
    title: 'Kong Vong Toch',
    shortDesc: 'From Irrawaddy to Mekong: Sound Migrations – Kong Vong Toch',
    contributor: 'High Alter (Lynn Nandar Htoo)',
    location: 'Phnom Penh, Cambodia',
    desc: "\n      Growing up immersed in Buddhist culture, I have always known the gong as a sacred instrument—from the grand gongs of pagodas to the small household gongs used for အမျှဝေ, the practice of spreading good deeds through sound. Now, working in Cambodia and recording traditional musicians, I find myself caught between familiarity and homesickness. The Cambodian gongs resonate with something deeply recognizable, yet each strike reminds me of Myanmar, a country currently in turmoil, where I cannot return.\n\nWhat fascinate me most is a particular paradox I've seen day to day: the aunties in Myanmar who mindfully strike their gongs in the morning, sharing merit and spreading peace through sound, only to find themselves shouting and fighting with family members by evening. I mention this not with judgment but with profound understanding. When daily life brings constant struggle, these women embody the human condition: aspiring toward peace while being ground down by circumstances beyond their control.\n\nYet the gong's purpose remains unchanged. In both Myanmar and Cambodia, the moment when the gong sounds creates a space of presence and clarity. It may last only seconds as the bronze vibrations fade, but in that moment, something shifts. This brief sonic opening becomes even more vital.\n\nThe kong vong , the circular gong chime I've been documenting, is a traditional Cambodian circular gong chime, a kong vong toch (small/high-pitched version) with five bronze gongs suspended vertically in a rattan frame. Each gong features a raised central boss that musicians strike with padded mallets to produce melodic tones, with precise tuning achieved through a traditional mixture of beeswax, lead, and rice husks applied to the interior. The instrument is adorned with colorful tiered cloth decorations in yellow, green, and red - traditional Cambodian colors - at its base. Musicians sit within the center of the circular frame and move around the arc striking different gongs to create flowing melodic patterns that support and embellish the lead xylophone in the classical pinpeat ensemble. This instrument represents over a thousand years of Cambodian musical tradition, with similar gong chimes depicted on the walls of Angkor Wat and other ancient temples. The workshop setting suggests this is part of crucial preservation efforts to revive traditional instrument-making techniques that were nearly lost during the Khmer Rouge period. These circular gong chimes serve as both melodic instruments in court music and sacred objects connecting earthly performances with spiritual realms in Cambodian cosmology.\nCambodia's kong vong toch carries its own story of survival. Nearly destroyed during the Khmer Rouge period, these instruments were preserved by musicians who refused to let their traditions die. Like Myanmar, Cambodia has endured profound political trauma, and like Myanmar, it has kept these sacred sounds alive.\n\nBoth countries understand that tradition persists not when life is easy, but when it becomes essential—when the sound of a gong offers the only moment of peace available in an otherwise chaotic day.\n\nRecording Detail\nDate: September 19, 2025\nPlace: Phnom Penh, Cambodia\nRecorded with Zoom H8\n      ",
    source: {
      title: 'Kong Vong Toch',
      src: 'https://www.dropbox.com/scl/fi/3s4sjz7123iasnxfff0rf/Khmer-Circular-Gong-Chimes-Lynn-Nandar-Htoo.wav?rlkey=56sxg1tpm7rv8anz5r69pzfh5&dl=0'
    },
    images: [],
    data: [
      {
        id: '#1',
        freq: 454.5,
        overtoneI: 1349,
        overtoneII: 3951,
        dividedFreq: 0,
        cents: 0,
        accumulate: 0
      },
      {
        id: '#2',
        freq: 540.3,
        overtoneI: 1595,
        overtoneII: 3029,
        dividedFreq: 1.188778878,
        cents: 299.3764651,
        accumulate: 299.3764651
      },
      {
        id: '#3',
        freq: 781.4,
        overtoneI: 2245,
        overtoneII: 4210,
        dividedFreq: 1.446233574,
        cents: 638.7606883,
        accumulate: 938.1371533
      },
      {
        id: '#4',
        freq: 841.9,
        overtoneI: 2460,
        overtoneII: 4545,
        dividedFreq: 1.077425134,
        cents: 129.1051514,
        accumulate: 1067.242305
      },
      {
        id: '#5',
        freq: 1941,
        overtoneI: 3644,
        overtoneII: null,
        dividedFreq: 2.305499465,
        cents: 1446.095198,
        accumulate: 2513.337502
      }
    ]
  },
  {
    title: 'Bensonhurst Kulintang',
    shortDesc: '',
    contributor: 'an_outskirt',
    location: 'Brooklyn, The United State',
    desc: "\n      A Conversation between elekhlekha and an_outskirt\n\nelekhlekha: We are thinking of the sound itself—how it passes to the next generation. More and more, it's transforming into a digital version of itself. How can we evolve in a way that still carries on the story, that carries on the lineage of it, rather than having it stripped down, flattened to just numbers? We are thinking a lot about that.\nThis community archive, in many ways, is still an experiment because we are not professional librarians. We are not professional archivists. I think we need more of this approach moving forward. Because who usually has the expertise to make the archive? And can we not do it from a Western lens? Can we do it from a community aspect?\nThat's why all the stories surrounding the sound are really valued. For example, when you describe how you learn the sound—that it is not the \"right\" way, but that is even more important. What is the disconnection, and why? Where did you learn the sound? What is your personal finding, your personal sound, and how did you find your voice?\n\nAnd also, the reason we choose to record instead of just labeling things—\"This is Kulintang,\" \"This is from what part of the Philippines.\" That's important too, but instead of just having a label, tag, or numbers, it could be a long-form recording, which we can then transcribe and edit and share in that way. So it's not only just a name, and then everybody has to guess what that means. So, a lot of work!\n\nan_outskirt: It's a daunting project.\nFor us, the issue, if it can be called that, is our role in the tradition of musics that feel like they are ours only in the most superficial way. What that means for us is that when our teacher says that Tagunggo was played for healing rituals we only know it as a dry and abstracted bit of information. The contradiction we feel with it comes from our position between the fact that it was taught to us in the halls of academia and our practice is removed many times over from the culture it was originally a feature of and the strong intuition that history itself is contained in sound. \n\nSo in some way, one could say very much say that it is a question of rights. What right have we to this tradition is a perfectly valid question for us. We find your project of building a library of practice or maybe creating a space for various investigators to share their processes very inspiring. It’s open in the sense of assuming very little in terms of that giant gewgaw- Authenticity.  \n\nFor our part, we want to engage with all these lost traditions in a manner of utmost sincerity and earnestness. The Philippines is a country that has been in some kind of colonized state for the better part of four centuries. The list of lost things exceeds any one person’s ability to list. Like all archival projects ours comes with all the pratfalls inherent in the investigation of memory both personal and cultural. What we try to do is the instruments we play, the words we speak, the dances we perform not be mere trophies in a collection that presents us as Filipino.\nelekhlekha: So it's nice to be expansive and try a different way to see. We feel like that's so rebel—the act of recording the gong that cannot be moved, and doing something with the thing that they say is prohibited, and just using it.\n\nan_outskirt: Yes! Our education was based on Western ideas and methods, mostly, and each item, or let’s say characteristic that we glean from, say, the precolonial, points to some very clear cleavage between what we were taught in school. Not to say that one is better or not, but each paradigm stands in direct contradistinction to the other. A good example is what we’ve talked about before with the flutist we sought to record in some remote village in Mindanao. He asked us to come back while he builds his flute to play. The notion of a material culture here, too, strikes me in retrospect. But I wanted to get to his system for tuning his instrument: he measured the circumference of the bamboo reed he picked with a blade of grass, and the four holes he bored on the reed to make the flute were the circumference made into a line. That is to say, the concept of an absolute pitch reference, like we have for Western Classical music, was totally foreign. He quite literally pulled out his tuning from the ground. I love this story. It’s a simple solution to battle homogeneity if one has an issue with it. Each factor in making the music, or even deeper–the ingredients of the sound–is dependent solely on the physical location where it is made. To further this point, that flutist told us that the music he played (his repertoire in our parlance) was not as robust as when he was younger because all he did was copy birdsong, and most of those birds that he mimicked were no longer there. \nIn a strange way, that is what is happening now with us, because we are a village of two, and we are just trying to figure it out. That's why we like the Tongatong, the bamboo stomping tubes, because it's even more inexact, and it is really democratizing. No expertise involved. You just need to know up and down, and who’s beside you, then you can go in and out. The music is really forgiving and fundamentally communal. Unlike a piano sonata, for example, if there's one wrong note, everybody is like, \"Oh my god, it's wrong.\" But with Tongatong, you can go in, and everybody gets together, making noise and sound. It's forgiving.\n\nelekhlekha: That's why we are not trying to create an archive website that is an official tuning system or anything. We are trying to understand and bring together the personal findings of each of us who are still practicing this and seeking to pass down this knowledge, while also allowing it to evolve. It's very important to us to say that this is not an official tuning system. Well, there is probably no official tuning system, in a way.\n\nan_outskirt: Or if there was, we could not know it.\n      ",
    source: {
      title: '',
      src: ''
    },
    images: [],
    data: [
      {
        id: '#1',
        freq: 750.5,
        overtone: 1175,
        dividedFreq: 0,
        cents: 0,
        accumulate: 0
      },
      {
        id: '#2',
        freq: 850.9,
        overtone: 1289,
        dividedFreq: 1.133777482,
        cents: 217.3650249,
        accumulate: 217.3650249
      },
      {
        id: '#3',
        freq: 1026,
        overtone: 1543,
        dividedFreq: 1.205782113,
        cents: 323.9630799,
        accumulate: 541.3281048
      },
      {
        id: '#4',
        freq: 1118,
        overtone: 1651,
        dividedFreq: 1.089668616,
        cents: 148.6673487,
        accumulate: 689.9954535
      },
      {
        id: '#5',
        freq: 1223,
        overtone: 1643,
        dividedFreq: 1.09391771,
        cents: 155.4050588,
        accumulate: 845.4005123
      },
      {
        id: '#6',
        freq: 1369,
        overtone: 1837,
        dividedFreq: 1.119378577,
        cents: 195.2376513,
        accumulate: 1040.638164
      },
      {
        id: '#7',
        freq: 1525,
        overtone: 2071,
        dividedFreq: 1.11395179,
        cents: 186.8241553,
        accumulate: 1227.462319
      },
      {
        id: '#8',
        freq: 1648,
        overtone: 2237,
        dividedFreq: 1.080655738,
        cents: 134.2883998,
        accumulate: 1361.750719
      }
    ]
  },
  {
    title: 'Sumba',
    shortDesc: '',
    contributor: 'elekhlekha',
    location: 'Sumba Island, Indonesia',
    desc: 'On the island of Sumba, there exists an indigenous animistic faith known as Marapu, in which funerals hold significant importance among their rituals.\n\nThe local community refers to gongs as ana mongu, and a complete set consists of six gongs.\n\nThese gongs have distinct names based on their size, which are paranja lamba for the smallest, followed by kabollu, gaha dita, and gaha wawa, with tatala designating the two largest gongs.',
    source: {
      title: 'Music for Funeral Ceremony by Sumba (Sumba Island Indonesia)',
      src: 'https://subrosalabel.bandcamp.com/track/music-for-funeral-ceremony-by-sumba-sumba-island-indonesia'
    },
    images: [],
    data: [
      {
        id: '#1',
        freq: 133,
        dividedFreq: 0,
        cents: 0,
        accumulate: 0
      },
      {
        id: '#2',
        freq: 148,
        dividedFreq: 1.112781955,
        cents: 185.0051162,
        accumulate: 185.0051162
      },
      {
        id: '#3',
        freq: 167,
        dividedFreq: 1.128378378,
        cents: 209.1011122,
        accumulate: 394.1062284
      },
      {
        id: '#4',
        freq: 181,
        dividedFreq: 1.083832335,
        cents: 139.3699135,
        accumulate: 533.4761419
      },
      {
        id: '#5',
        freq: 220,
        dividedFreq: 1.215469613,
        cents: 337.8165917,
        accumulate: 871.2927336
      },
      {
        id: '#6',
        freq: 260,
        dividedFreq: 1.181818182,
        cents: 289.2097194,
        accumulate: 1160.502453
      },
      {
        id: '#7',
        freq: 300,
        dividedFreq: 1.153846154,
        cents: 247.741053,
        accumulate: 1408.243506
      },
      {
        id: '#8',
        freq: 333,
        dividedFreq: 1.11,
        cents: 180.6716119,
        accumulate: 1588.915118
      },
      {
        id: '#9',
        freq: 364,
        dividedFreq: 1.093093093,
        cents: 154.0995278,
        accumulate: 1743.014646
      },
      {
        id: '#10',
        freq: 436,
        dividedFreq: 1.197802198,
        cents: 312.4676215,
        accumulate: 2055.482267
      }
    ]
  },
  {
    title: "T'boli",
    contributor: 'elekhlekha',
    shortDesc: '',
    location: 'Southwestern Mindanao, Philippines',
    desc: 'The powerful suspended bronze gongs are a symbol of community gatherings.\n\nThey serve to call people together from afar and are linked to elements like thunder, storms, and the mystical abilities of the folk hero Tudbulul, also known as Semgulang.\n\nDuring times of collective joy, the act of striking the gongs expresses the feeling of happiness (heligal).In memory of Swik Sabal who was gunned down on the night of July 13, 1993 while negotiating a peaceful resolution to a land dispute between his people and new setterlers.',
    source: {
      title: 'Sound of the Wind (Utom luk lenos)',
      src: 'https://folkways.si.edu/danilo-kasaw/sound-of-the-wind-utom-luk-lenos/world/music/track/smithsonian'
    },
    images: [],
    data: [
      {
        id: '#1',
        freq: 135,
        dividedFreq: 0,
        cents: 0,
        accumulate: 0
      },
      {
        id: '#2',
        freq: 171,
        dividedFreq: 1.266666667,
        cents: 409.2443014,
        accumulate: 409.2443014
      },
      {
        id: '#3',
        freq: 213,
        dividedFreq: 1.245614035,
        cents: 380.2285264,
        accumulate: 789.4728278
      },
      {
        id: '#4',
        freq: 223,
        dividedFreq: 1.046948357,
        cents: 79.42833563,
        accumulate: 868.9011634
      },
      {
        id: '#5',
        freq: 376,
        dividedFreq: 1.686098655,
        cents: 904.4267421,
        accumulate: 1773.327906
      },
      {
        id: '#6',
        freq: 425,
        dividedFreq: 1.130319149,
        cents: 212.0762152,
        accumulate: 1985.404121
      }
    ]
  },
  {
    title: 'Ede Bih',
    contributor: 'elekhlekha',
    shortDesc: '',
    location: 'Ðǎk Lǎk province of Central Vietnam',
    desc: "This sound culture data set is learned from the performance of Song for a Dead Man by the Ede Bih community in Ðǎk Lǎk province of Central Vietnam, which features a gong ensemble consisting of five women performers.\n\nMen are prohibited from playing the gongs due to the belief that the gongs' shape resembles female breasts.\n\nThe knobbed gongs they play are usually kept in a church, reflecting their religious practices that blend indigenous animism with Christian Protestantism.",
    source: {
      title: 'Song for a Dead Man by Ede Bih (Vietnam)',
      src: 'https://subrosalabel.bandcamp.com/track/song-for-a-dead-man-by-ede-bih-vietnam'
    },
    images: [],
    data: [
      {
        id: '#1',
        freq: 160,
        dividedFreq: 0,
        cents: 0,
        accumulate: 0
      },
      {
        id: '#2',
        freq: 196,
        dividedFreq: 1.225,
        cents: 351.3380991,
        accumulate: 351.3380991
      },
      {
        id: '#3',
        freq: 225,
        dividedFreq: 1.147959184,
        cents: 238.8856165,
        accumulate: 590.2237156
      },
      {
        id: '#4',
        freq: 250,
        dividedFreq: 1.111111111,
        cents: 182.4037121,
        accumulate: 772.6274277
      },
      {
        id: '#5',
        freq: 270,
        dividedFreq: 1.08,
        cents: 133.2375749,
        accumulate: 905.8650026
      },
      {
        id: '#6',
        freq: 288,
        dividedFreq: 1.066666667,
        cents: 111.7312853,
        accumulate: 1017.596288
      },
      {
        id: '#7',
        freq: 331,
        dividedFreq: 1.149305556,
        cents: 240.9148864,
        accumulate: 1258.511174
      },
      {
        id: '#8',
        freq: 450,
        dividedFreq: 1.359516616,
        cents: 531.7125413,
        accumulate: 1790.223716
      }
    ]
  },
  {
    title: 'Isneg',
    contributor: 'elekhlekha',
    shortDesc: '',
    location: 'Izne, Phillippines',
    desc: 'This sound culture is learned from a performance of Rooster Dance from Isneg Group in Izne, Phillippines',
    source: 'https://subrosalabel.bandcamp.com/track/rooster-dance-by-isneg-group-izne-philippines',
    images: [],
    data: [
      {
        id: '#1',
        freq: 154,
        dividedFreq: 0,
        cents: 0,
        accumulate: 0
      },
      {
        id: '#2',
        freq: 544,
        dividedFreq: 3.532467532,
        cents: 2184.811561,
        accumulate: 2184.811561
      },
      {
        id: '#3',
        freq: 608,
        dividedFreq: 1.117647059,
        cents: 192.5576066,
        accumulate: 2377.369167
      },
      {
        id: '#4',
        freq: 749,
        dividedFreq: 1.231907895,
        cents: 361.073274,
        accumulate: 2738.442441
      }
    ]
  },
  {
    title: "Lahu Shi's Bulo Ko",
    contributor: 'elekhlekha',
    shortDesc: '',
    location: 'Shan State, Myanmar',
    desc: "In Lahu household, a smaller alter gong, bulo ko, is use by head of the family to performs important rites at the alter to appease the yeh ne, the collective of benevolent spirits, seek the blessings of diety G'ui Sha, and protect family members from evil spirits, ne hay.",
    source:
      'https://www.dropbox.com/scl/fi/znodeuh6o29vt6pjnwhvh/Track-No20.mp3?rlkey=3oapo5vpmoxtaztdbjht074uz&dl=0',
    images: [],
    data: [
      {
        id: '#1',
        freq: 118,
        dividedFreq: 0,
        cents: 0,
        accumulate: 0
      },
      {
        id: '#2',
        freq: 140,
        dividedFreq: 1.186440678,
        cents: 295.9679611,
        accumulate: 295.9679611
      },
      {
        id: '#3',
        freq: 207,
        dividedFreq: 1.478571429,
        cents: 677.0447287,
        accumulate: 973.0126898
      },
      {
        id: '#4',
        freq: 409,
        dividedFreq: 1.975845411,
        cents: 1178.964091,
        accumulate: 2151.97678
      },
      {
        id: '#5',
        freq: 701,
        dividedFreq: 1.71393643,
        cents: 932.7763213,
        accumulate: 3084.753102
      },
      {
        id: '#6',
        freq: 881,
        dividedFreq: 1.256776034,
        cents: 395.6730899,
        accumulate: 3480.426191
      }
    ]
  },
  {
    title: 'Punong/Bu Noeur (Khmer Loue)',
    contributor: 'elekhlekha',
    shortDesc: '',
    location: 'Mondulkiri province, Northwest Cambodia',
    desc: 'This sound culture originates from a recording of Khmer Loeu, particularly associated with the Bu Noeur tribe located in Mondulkiri province in northwestern Cambodia today.\n\nThe traditional instruments, the Khong, which comprises gongs of various sizes with flat or nipple-shaped surfaces.\n\nAlthough several playing techniques for the Khong remain unrecorded, some known methods include striking with a closed fist, open palm, flat fingers, or the back of the hand, all executed with precise hits and damping methods.',
    source: {
      title: 'Khmer Loeu, Khong (gong) ensemble, Phnom Penh',
      src: 'https://folkways.si.edu/khmer-loeu-2/world/music/track/smithsonian'
    },
    images: [],
    data: [
      {
        id: '#1',
        freq: 369,
        dividedFreq: 0,
        cents: 0,
        accumulate: 0
      },
      {
        id: '#2',
        freq: 458,
        dividedFreq: 1.241192412,
        cents: 374.0721384,
        accumulate: 374.0721384
      },
      {
        id: '#3',
        freq: 493.6,
        dividedFreq: 1.077729258,
        cents: 129.5937554,
        accumulate: 503.6658938
      },
      {
        id: '#4',
        freq: 554.4,
        dividedFreq: 1.123176661,
        cents: 201.1018356,
        accumulate: 704.7677294
      },
      {
        id: '#5',
        freq: 682,
        dividedFreq: 1.23015873,
        cents: 358.6133781,
        accumulate: 1063.381108
      },
      {
        id: '#6',
        freq: 740,
        dividedFreq: 1.085043988,
        cents: 141.3042378,
        accumulate: 1204.685345
      },
      {
        id: '#7',
        freq: 823,
        dividedFreq: 1.112162162,
        cents: 184.0405919,
        accumulate: 1388.725937
      }
    ]
  },
  {
    title: 'Punong',
    contributor: 'elekhlekha',
    shortDesc: '',
    location: 'Mondulkiri province, Cambodia',
    desc: 'In Northeast Cambodia, various ethnic groups have a custom of sharing an earthen pot of rice wine, sipping it through long straws.\n\nFollowing this, they toss rice grains onto a plate stacked with offerings, which include whole blackened chickens, tobacco, sweets, and fruit, while a shaman performs a prayer lasting two to three minutes.\n\nGong performances are allowed to commence only after this ritual is finished.\n\nPlaying gongs outside of a ritual context is believed to risk attracting spirits, who could become upset due to the absence of offerings and potentially cause illness among villagers.\n\nAdditionally, the style of gong music differs not between ethnic groups, but rather from one village to another.',
    source: {
      title: 'Offering to the Spirits by Punong (Cambodia)',
      src: 'https://subrosalabel.bandcamp.com/track/offering-to-the-spirits-by-punong-cambodia'
    },
    images: [],
    data: [
      {
        id: '#1',
        freq: 111,
        dividedFreq: 0,
        cents: 0,
        accumulate: 0
      },
      {
        id: '#2',
        freq: 134.4,
        dividedFreq: 1.210810811,
        cents: 331.1681538,
        accumulate: 331.1681538
      },
      {
        id: '#3',
        freq: 143.6,
        dividedFreq: 1.068452381,
        cents: 114.6271333,
        accumulate: 445.7952871
      },
      {
        id: '#4',
        freq: 159,
        dividedFreq: 1.10724234,
        cents: 176.3652196,
        accumulate: 622.1605067
      },
      {
        id: '#5',
        freq: 192.8,
        dividedFreq: 1.212578616,
        cents: 333.6939433,
        accumulate: 955.85445
      },
      {
        id: '#6',
        freq: 287.3,
        dividedFreq: 1.490145228,
        cents: 690.5435296,
        accumulate: 1646.39798
      }
    ]
  }
];

export { findTuning, getNgeaScaleIntervals } from '$objects/ngea/utils';
