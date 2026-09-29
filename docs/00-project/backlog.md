# Backlog

Work that is known and not yet scheduled. Each section links its GitHub issue.

## Placement data: colleges without it (#134)

_Checked 2026-09-29._ Placement data covers 145 of the 387 current colleges: 108 from NIRF, 70 from
the colleges' own websites, 33 from both (#132). The 242 below have neither. To add a college,
re-crawl it with `packages/pipeline/scripts/crawlPlacementPages.mjs` (a `code<TAB>url` list), then
run `npm run placement:claims -w @mhtcet/pipeline` and the staging load (`placement` key). Figures
read by hand from a college's own documents (images, scanned PDFs) go in
`packages/pipeline/data/placement-manual.json`.

### Site loads but shows no figures as text (140)

Figures are in images, posters or brochure PDFs that are scans. Next: OCR the placement page images and brochure PDFs; otherwise ask the college.

| Code | College | District | Type | Site tried |
|---|---|---|---|---|
| 01005 | Sant Gadge Baba Amravati University,Amravati | Amravati | Government | <https://www.sgbau.ac.in> |
| 01012 | Government College of Engineering,Yavatmal | Yavatmal | Government | <https://gcoey.ac.in/> |
| 01117 | Janata Shikshan Prasarak Mandal’s Babasaheb Naik College Of Engineering, Pusad | Yavatmal | Unaided | <https://www.bncoepusad.ac.in> |
| 01121 | Shri Hanuman Vyayam Prasarak Mandals College of Engineering & Technology, Amravati | Amravati | Unaided | <https://www.hvpmcoet.in> |
| 01123 | Dr.Rajendra Gode Institute of Technology & Research, Amravati | Amravati | Unaided | <https://www.drgitr.ac.in/> |
| 01125 | Dwarka Bahu Uddeshiya Gramin Vikas Foundation, Rajarshi Shahu College of Engineering, Buldhana | Buldhana | Unaided | <https://rsce.ac.in> |
| 01127 | Jagadambha Bahuuddeshiya Gramin Vikas Sanstha&#39;s Jagdambha College of Engineering and Technology, Yavatmal | Yavatmal | Unaided | <https://jcoet.ac.in> |
| 01130 | Vision Buldhana Educational & Welfare Society&#39;s Pankaj Laddhad Institute of Technology & Management Studies, Yelgaon | Buldhana | Unaided | <https://plit.ac.in> |
| 01180 | Sanmati Engineering College, Sawargaon Barde, Washim | Washim | Unaided | <https://www.sanmati.edu.in/> |
| 01182 | Padmashri Dr. V.B. Kolte College of Engineering, Malkapur, Buldhana | Buldhana | Unaided | <https://coemalkapur.ac.in/> |
| 01347 | LET.DR. D. B. DOD COLLEGE OF ENGINEERING | Amravati | Unaided | <https://www.dbdengcollege.in> |
| 02111 | Everest Education Society, Group of Institutions (Integrated Campus), Ohar | Chhatrapati Sambhaji Nagar | Unaided | <https://www.eescoet.org> |
| 02113 | G. S. Mandal&#39;s Maharashtra Institute of Technology, Aurangabad | Chhatrapati Sambhaji Nagar | Unaided | <https://www.mit.asia/> |
| 02127 | Mahatma Gandhi Missions College of Engineering, Hingoli Rd, Nanded. | Nanded | Unaided | <https://mgmcen.ac.in> |
| 02133 | Mahatma Basaweshwar Education Society&#39;s College of Engineering, Ambejogai | Beed | Unaided | <https://www.coea.ac.in> |
| 02135 | Hi-Tech Institute of Technology, Aurangabad | Chhatrapati Sambhaji Nagar | Unaided | <https://www.hitechengg.edu.in/> |
| 02137 | Nagnathappa Halge Engineering College, Parli, Beed | Beed | Unaided | <https://www.nhce.in> |
| 02146 | Adarsh Shikshan Prasarak Mandal&#39;s K. T. Patil College of Engineering and Technology, Osmanabad | Dharashiv | Unaided | <https://ktpcoeo.com> |
| 02189 | Vishweshwarayya Institute Of Engineering And Technology, Almala, Tq. Ausa, Dist. Latur | Latur | Unaided | <https://www.viet.ac.in> |
| 02252 | Marathwada Shikshan Prasarak Mandal&#39;s Shri Shivaji Institute of Engineering and Management Studies, Parbhani | Parbhani | Unaided | <https://www.ssiems.org.in> |
| 02254 | Vilasrao Deshmukh Foundation Group of Institutions, Latur | Latur | Unaided | <https://www.vdfengineering.co.in> |
| 02637 | Jijau Institute of Engineering Technology and Management, Khandgaon (Bendri), Taluka Naigaon, District Nanded | Nanded | Unaided | <https://jijauinstetm.edu.in> |
| 02666 | Mangaldeep College of Engineering | Chhatrapati Sambhaji Nagar | Unaided | <https://mangaldeep.org> |
| 02770 | Shetkari Shikshan Prasarak Mandal&#39;s Mahesh Institute of Engineering and Technology , Ashti | Beed | Unaided | <https://sspmsmietashti.in> |
| 02771 | Amolak College of Engineering Kada | Beed | Unaided | <https://www.amolakcoe.org> |
| 02777 | CDS College of Engineering | Nanded | Unaided | <https://cdscollege.in> |
| 02779 | NKSPT INSTITUTE OF ENGINEERING AND TECHNOLOGY PATHRIKAR CAMPUS | Hingoli | Unaided | <https://nkspt.org/ioe/> |
| 03025 | Svkm&#39;s Shri Bhagubhai Mafatlal Polytechnic & College of Engineering | Mumbai-Suburban | Government-Aided | <https://sbmp.ac.in> |
| 03042 | Loknete Shamrao Peje Government College of Engineering, Ratnagiri | Ratnagiri | Government | <https://gcoer.ac.in> |
| 03135 | Manjara Charitable Trust&#39;s Rajiv Gandhi Institute of Technology, Mumbai | Mumbai-Suburban | Unaided | <https://www.mctrgit.ac.in/> |
| 03143 | Thakur Shyamnarayan Engineering College, Mumbai | Mumbai-Suburban | Unaided | <https://tsecmumbai.in/> |
| 03146 | Jawahar Education Society&#39;s Annasaheb Chudaman Patil College of Engineering,Kharghar, Navi Mumbai | Raigad | Unaided | <https://acpce.ac.in> |
| 03147 | Saraswati Education Society, Yadavrao Tasgaonkar Institute of Engineering & Technology, Karjat | Raigad | Unaided | <https://ytiet.com> |
| 03176 | Thakur College of Engineering and Technology, Kandivali, Mumbai | Mumbai-Suburban | Unaided | <https://www.tcetmumbai.in/> |
| 03183 | Anjuman-I-Islam&#39;s M.H. Saboo Siddik College of Engineering, Byculla, Mumbai | Mumbai-City | Unaided | <https://www.mhssce.ac.in> |
| 03192 | Smt. Indira Gandhi College of Engineering, Navi Mumbai | Thane | Unaided | <https://www.sigce.edu.in/> |
| 03198 | Konkan Gyanpeeth College of Engineering, Karjat | Raigad | Unaided | <https://www.kgce.edu.in> |
| 03201 | Rizvi Education Society&#39;s Rizvi College of Engineering, Bandra,Mumbai | Mumbai-Suburban | Unaided | <https://eng.rizvi.edu.in/> |
| 03203 | Atharva College of Engineering,Malad(West),Mumbai | Mumbai-Suburban | Unaided | <https://atharvacoe.ac.in/> |
| 03209 | K J Somaiya Institute of Technology | Mumbai-City | Unaided | <https://kjsit.somaiya.edu.in> |
| 03212 | Watumull Institute of Engineering & Technology, Ulhasnagar | Thane | Unaided | <https://www.watumull.edu> |
| 03220 | Yadavrao Tasgaonkar College of Engineering & Management | Raigad | Unaided | <https://ytcem.com> |
| 03221 | Vishnu Waman Thakur Charitable Trust&#39;s VIVA Institute of Technology, Virar | Palghar | Unaided | <https://www.viva-technology.org> |
| 03222 | Haji Jamaluddin Thim Trust&#39;s Theem College of Engineering, At. Villege Betegaon, Boisar | Palghar | Unaided | <https://www.theemcoe.org> |
| 03257 | Vidya Prasarak Mandal&#39;s College of Engineering, Thane | Thane | Unaided | <https://vpmthane.org/> |
| 03277 | Pravin Rohidas Patil College of Engineering & Technology | Thane | Unaided | <https://prpengineering.in> |
| 03353 | Dilkap Research Institute Of Engineering and Management Studies, At.Mamdapur, Post- Neral, Tal- Karjat, Mumbai | Raigad | Unaided | <https://driems.in> |
| 03440 | Metropolitan Institute of Technology & Management, Sukhalwad, Sindhudurg. | Sindhudurg | Unaided | <https://www.mitm.ac.in/> |
| 03445 | Vishwatmak Jangli Maharaj Ashram Trust (Kokamthan), Atma Malik Institute Of Technology & Research | Thane | Unaided | <https://www.amitr.edu.in> |
| 03471 | New Horizon Institute of Technology & Management, Thane | Thane | Unaided | <https://nhitm.ac.in/> |
| 03503 | Indala College Of Engineering, Bapsai Tal.Kalyan | Thane | Unaided | <https://icoe.ac.in> |
| 03723 | Navjeevan Education Society&#39;s College of Engineering, Bhandup(W), Mumbai | Mumbai-Suburban | Unaided | <https://navjeevanengineering.in> |
| 03724 | Thakur Shree DPS College of Engineering & Management | Mumbai-Suburban | Unaided | <https://www.tsdcem.ac.in> |
| 04118 | Bapurao Deshmukh College of Engineering, Sevagram | Wardha | Unaided | <https://www.bdce.edu.in> |
| 04123 | Lokmanya Tilak Jankalyan Shikshan Sanstha, Priyadarshani College of Engineering, Nagpur | Nagpur | Unaided | <https://pcenagpur.edu.in> |
| 04133 | Sanmarg Shikshan Sanstha&#39;s Smt. Radhikatai Pandav College of Engineering, Nagpur | Nagpur | Unaided | <https://www.srpce.ac.in> |
| 04135 | Amar Seva Mandal&#39;s Shree Govindrao Vanjari College of Engineering & Technology, Nagpur | Nagpur | Unaided | <https://gwcet.ac.in> |
| 04138 | Jaidev Education Society, J D College of Engineering and Management, Nagpur | Nagpur | Unaided | <https://www.jdcoem.ac.in/> |
| 04141 | Shriram Gram Vikas Shikshan Sanstha, Vilasrao Deshmukh College of Engineering and Technology, Nagpur | Nagpur | Unaided | <https://www.vdcet.in> |
| 04143 | Sanmarg Shikshan Sanstha, Mandukarrao Pandav College of Engineering, Bhandara | Bhandara | Unaided | <https://www.mpcoe.edu.in> |
| 04145 | Wainganga College of Engineering and Management, Dongargaon, Nagpur | Nagpur | Unaided | <https://www.wcem.in/> |
| 04147 | K.D.K. College of Engineering, Nagpur | Nagpur | Unaided | <https://www.kdkce.edu.in/> |
| 04163 | Rajiv Gandhi College of Engineering Research & Technology Chandrapur | Chandrapur | Unaided | <https://www.rcert.ac.in/> |
| 04175 | JMSS Shri Shankarprasad Agnihotri College of Engineering, Wardha | Wardha | Unaided | <https://www.sspace.ac.in/> |
| 04181 | Swaminarayan Siddhanta Institute Of Technology, Nagpur | Nagpur | Unaided | <https://ssitngp.in> |
| 04197 | Jai Mahakali Shikshan Sanstha, Agnihotri College of Engineering, Sindhi(Meghe) | Wardha | Unaided | <https://www.acenagthana.ac.in> |
| 04703 | Somayya Institute of Technology, Chandrapur | Chandrapur | Unaided | <https://somayyainstituteoftechnology.com/> |
| 04762 | Mata Mahakali College of Engineering & Technology, Warora | Chandrapur | Unaided | <https://mmcoet.org> |
| 05004 | Government College of Engineering, Jalgaon | Jalgaon | Government | <https://www.gcoej.ac.in/> |
| 05104 | Shramsadhana Bombay Trust, College of Engineering & Technology, Jalgaon | Jalgaon | Unaided | <https://www.sscoetjalgaon.ac.in> |
| 05125 | Pravara Rural Education Society&#39;s Sir Visvesvaraya Institute of Technology, Chincholi Dist. Nashik | Nashik | Unaided | <https://www.svitnashik.in> |
| 05151 | MET Bhujbal Knowledge City MET League&#39;s Engineering College, Adgaon, Nashik. | Nashik | Unaided | <https://www.metbhujbalknowledgecity.ac.in/> |
| 05152 | G H Raisoni College of Engineering and Management, Jalgaon | Jalgaon | Unaided | <https://www.ghrcemj.raisoni.net/> |
| 05160 | Sanjivani Rural Education Society&#39;s Sanjivani College of Engineering, Kopargaon | Ahilyanagar | Unaided | <https://www.sanjivani.org.in/> |
| 05161 | Dr. Vithalrao Vikhe Patil College of Engineering, Ahmednagar | Ahilyanagar | Unaided | <https://enggnagar.com> |
| 05168 | T.M.E. Society&#39;s J.T.Mahajan College of Engineering, Faizpur | Jalgaon | Unaided | <https://www.jtmcoef.ac.in> |
| 05169 | Nagaon Education Society&#39;s Gangamai College of Engineering, Nagaon, Tal Dist Dhule | Dhule | Unaided | <https://gangamaiengg.org.in> |
| 05170 | Hindi Seva Mandal&#39;s Shri Sant Gadgebaba College of Engineering & Technology, Bhusawal | Jalgaon | Unaided | <https://www.ssgbcoet.com> |
| 05179 | Vishwabharati Academy&#39;s College of Engineering, Ahmednagar | Ahilyanagar | Unaided | <https://vacoea.in> |
| 05184 | Amruta Vaishnavi Education & Welfare Trust&#39;s Shatabdi Institute of Engineering & Research, Agaskhind Tal. Sinnar | Nashik | Unaided | <https://siernashik.org.in> |
| 05223 | SMT. SHARCHCHANDRIKA SURESH PATIL INSTITUTE OF TECHNOLOGY (ENGINEERING & POLYTECHNIC), CHOPDA | Jalgaon | Unaided | <https://sspitpolytechnic.org> |
| 05239 | JAMIA INSTITUTE OF TECHNOLOGY | Nandurbar | Unaided | <https://www.jamiapolytechnic.org> |
| 05249 | Trimurti Shikshan Prasarak Mandal, Trimurti Institute Of Technology, Paladhi Bk, Jalgaon | Jalgaon | Unaided | <https://trimurtiinstitute.com> |
| 05303 | Hon. Shri. Babanrao Pachpute Vichardhara Trust, Group of Institutions (Integrated Campus)-Parikrama, Kashti Shrigondha, | Ahilyanagar | Unaided | <https://parikrama.edu.in> |
| 05365 | Vardhaman Education & Welfare Society, Ahinsa Institute of Technology, Post. Dondaicha, Dhule | Dhule | Unaided | <https://ahinsainstituteoftechnology.in/Main/> |
| 05380 | Adsul&#39;s Technical Campus, Chas Dist. Ahmednagar | Ahilyanagar | Unaided | <https://sgvssatc.com> |
| 05381 | Shri. Jaykumar Rawal Institute of Technology, Dondaicha. | Dhule | Unaided | <https://www.sjrit.ac.in> |
| 05396 | College of Engineering and Technology ,North Maharashtra Knowledge City, Jalgaon | Jalgaon | Unaided | <https://www.nmkcj.org.in> |
| 05399 | Sanghavi College of Engineering, Varvandi, Nashik. | Nashik | Unaided | <https://engineering.shreemahavir.org> |
| 05401 | Jawahar Education Society&#39;s Institute of Technology, Management & Research, Nashik. | Nashik | Unaided | <https://www.jitnashik.edu.in/> |
| 05408 | Vidya Niketan College of Engineering, Bota Sangamner | Ahilyanagar | Unaided | <https://vidyaniketanglobal.com> |
| 05414 | Nikam Institute of Technology And Management Studies ,Dhule | Dhule | Unaided | <https://nikampolytechnicdhule.ac.in> |
| 05497 | P.G. College of Engineering & Technology, Nandurbar | Nandurbar | Unaided | <https://pgcet.ac.in> |
| 05509 | Shri Swami Samarth Institute of Management and Technology, Malwadi-Bota | Ahilyanagar | Unaided | <https://www.sssi.edu.in> |
| 05513 | MKD Institute of Technology, Nadurbar | Nandurbar | Unaided | <https://mkdit.edu.in> |
| 05545 | Shri Vile Parle Kelavani Mandal&#39;s College of Engineering, Shirpur | Dhule | Unaided | <https://www.svkm.ac.in/> |
| 06004 | Government College of Engineering & Research, Avasari Khurd | Pune | Government | <https://www.gcoeara.ac.in/> |
| 06028 | SHIVAJI UNIVERSITY SCHOOL OF ENGINEERING AND TECHNOLOGY (DEPARTMENT OF TECHNOLOGY) | Kolhapur | Government | <https://www.unishivaji.ac.in> |
| 06036 | Government College of Engineering, Kolhapur | Kolhapur | Government | <https://www.gcoekolhapur.ac.in/> |
| 06041 | Punyashlok Ahilyadevi Holkar Solapur University, Solapur | Solapur | Government | <https://su.digitaluniversity.ac> |
| 06139 | Progressive Education Society&#39;s Modern College of Engineering, Pune | Pune | Unaided | <https://moderncoe.edu.in/> |
| 06144 | Genba Sopanrao Moze College of Engineering, Baner-Balewadi, Pune | Pune | Unaided | <https://www.gsmozecoe.org> |
| 06178 | Sinhgad Technical Education Society&#39;s Smt. Kashibai Navale College of Engineering,Vadgaon,Pune | Pune | Unaided | <https://www.sinhgad.edu/> |
| 06179 | Indira College of Engineering & Management, Pune | Pune | Unaided | <https://www.indiraicem.ac.in/> |
| 06187 | Sinhgad Academy of Engineering, Kondhwa (BK) Kondhwa-Saswad Road, Pune | Pune | Unaided | <https://www.sinhgad.edu/> |
| 06207 | Dr. D. Y. Patil Unitech Society&#39;s Dr. D. Y. Patil Institute of Technology, Pimpri, Pune | Pune | Unaided | <https://engg.dypvp.edu.in/> |
| 06214 | K. E. Society&#39;s Rajarambapu Institute of Technology, Walwa, Sangli | Sangli | Unaided | <https://ritindia.edu> |
| 06217 | Shri. Balasaheb Mane Shikshan Prasarak Mandal&#39;s, Ashokrao Mane Group of Institutions | Kolhapur | Unaided | <https://amgoi.edu.in/> |
| 06220 | SVERI&#39;s College of Engineering, Pandharpur | Solapur | Unaided | <https://www.sveri.ac.in/> |
| 06274 | PVG&#39;s College of Engineering, Technology & Management | Pune | Unaided | <https://www.pvgcoet.ac.in> |
| 06278 | All India Shri Shivaji Memorial Society&#39;s College of Engineering, Pune | Pune | Unaided | <https://www.aissmscoe.com/> |
| 06282 | All India Shri Shivaji Memorial Society&#39;s Institute of Information Technology,Pune | Pune | Unaided | <https://www.aissmsioit.org/> |
| 06303 | Dr. Ashok Gujar Technical Institute&#39;s Dr. Daulatrao Aher College of Engineering, Karad | Satara | Unaided | <https://www.dacoe.ac.in> |
| 06304 | Loknete Hanumantrao Charitable Trust&#39;s Adarsh Institute of Technology and Research Centre, Vita,Sangli | Sangli | Unaided | <https://www.aitrcvita.edu.in> |
| 06310 | Nutan Maharashtra Vidya Prasarak Mandal, Nutan Maharashtra Institute of Engineering &Technology, Talegaon station, Pune | Pune | Unaided | <https://www.nmiet.edu.in/> |
| 06313 | Jaywant College of Engineering & Polytechnic , Kille Macchindragad Tal. Walva District- Sangali | Sangli | Unaided | <https://jcep.edu.in> |
| 06321 | Vidya Vikas Pratishthan Institute of Engineering and Technology, Solapur | Solapur | Unaided | <https://vvpengineering.org> |
| 06324 | Rajgad Technical Campus | Pune | Unaided | <https://rajgad.edu.in/> |
| 06468 | Swami Vivekananda Shikshan Sanstha, Dr. Bapuji Salunkhe Institute Of Engineering & Technology,Kolhapur | Kolhapur | Unaided | <https://www.bsiet.org> |
| 06545 | Samarth Education Trust&#39;s Arvind Gavali College Of Engineering Panwalewadi, Varye,Satara. | Satara | Unaided | <https://www.agce.edu.in> |
| 06609 | Jaihind College Of Engineering,Kuran | Pune | Unaided | <https://jaihind.edu.in/jcoe/> |
| 06635 | Samarth College of Engineering and Management | Pune | Unaided | <https://samarthinstitute.edu.in/engg/> |
| 06640 | N. B. Navale Sinhgad College of Engineering, Kegaon, solapur | Solapur | Unaided | <https://www.sinhgad.edu/> |
| 06643 | S K N Sinhgad College of Engineering, Korti Tal. Pandharpur Dist Solapur | Solapur | Unaided | <https://www.sinhgad.edu/> |
| 06715 | Babasaheb Phadtare Engineering & Technology Kalamb-Walchandnagar Tal Indapur Dist Pune | Pune | Unaided | <https://www.dkkkpbpp.edu.in> |
| 06732 | Ajeenkya DY Patil School of Engineering, Lohegaon, Pune | Pune | Unaided | <https://www.adypsoe.in/> |
| 06756 | Fabtech Technical Campus College of Engineering and Research, Sangola | Solapur | Unaided | <https://www.ftccoe.ac.in> |
| 06759 | Shree Ramchandra College of Engineering, Lonikand,Pune | Pune | Unaided | <https://www.srespune.org> |
| 06766 | Phaltan Education Society&#39;s College of Engineering Thakurki Tal- Phaltan Dist-Satara | Satara | Unaided | <https://coephaltan.edu.in> |
| 06768 | P.K. Technical Campus, Pune. | Pune | Unaided | <https://www.pkinstitute.edu.in> |
| 06769 | Rasiklal M. Dhariwal Sinhgad Technical Institutes Campus, Warje, Pune. | Pune | Unaided | <https://www.sinhgad.edu/> |
| 06771 | Flora Institute of Technology, Khopi, Near Khed Shivapur Toll Plaza, Pune | Pune | Unaided | <https://www.flora.ac.in> |
| 06772 | NBN Sinhgad Technical Institutes Campus, Pune | Pune | Unaided | <https://www.sinhgad.edu/> |
| 06781 | Bhagwant Institute of Technology, Barshi | Solapur | Unaided | <https://bitbarshi.edu.in> |
| 06795 | Shri.Someshwar Shikshan Prasarak Mandal, Sharadchandra Pawar College of Engineering & Technology, Someshwar Nagar | Pune | Unaided | <https://www.secsomeshwar.ac.in> |
| 06839 | Dr. D Y Patil Pratishthan&#39;s College of Engineering, Kolhapur | Kolhapur | Unaided | <https://www.dypgroup.edu.in/> |
| 06938 | Shree Siddheshwar Women&#39;s College Of Engineering Solapur. | Solapur | Unaided | <https://sswcoe.edu.in> |
| 06991 | Dr. D.Y. Patil Technical Campus, Varale, Talegaon, Pune | Pune | Unaided | <https://www.dypatiltcs.com/> |
| 14005 | Laxminarayan Innovation Technological University, Nagpur | Nagpur | Government | <https://www.litu.edu.in/> |
| 16357 | MES MUKUNDDAS LOHIA COLLEGE OF ENGINEERING | Pune | Unaided | <https://mlcoe.mespune.in> |

### No website found (51)

No working official site found from the CAP list or a search. Next: find the official domain by hand, then re-crawl.

| Code | College | District | Type | Site tried |
|---|---|---|---|---|
| 01002 | Government College of Engineering, Amravati | Amravati | Government | – |
| 01101 | Shri Sant Gajanan Maharaj College of Engineering,Shegaon | Buldhana | Unaided | – |
| 02032 | Institute of Chemical Technology, Mumbai Marathwada off campus, Jalna | Jalna | Government | – |
| 02037 | Deen Dayal Upadhyay Kaushal Kendra, Dr.Babasaheb Ambedkar Marathwada University, Chhatrapati Sambhaji nagar | Chhatrapati Sambhaji Nagar | Government | – |
| 02250 | CHHATRAPATI SAMBHAJI MAHARAJ COLLEGE OF ENGINEERING | Chhatrapati Sambhaji Nagar | Unaided | – |
| 02634 | Eaglewood Polytechnic Institute, A.P Phulepimpalgaon | Jalna | Unaided | – |
| 02805 | Urvara Pathrikar Engineering College | Hingoli | Unaided | – |
| 03036 | Institute of Chemical Technology, Matunga, Mumbai | Mumbai-Suburban | Deemed University | – |
| 03193 | Shivajirao S. Jondhale College of Engineering, Dombivali,Mumbai | Thane | Unaided | – |
| 03351 | Bharat College of Engineering, Kanhor, Badlapur(W) | Thane | Unaided | – |
| 03726 | IImperial College of Engineering | Mumbai-Suburban | Unaided | – |
| 04026 | University Institute of Technology | Nagpur | Government | – |
| 04134 | Guru Nanak Institute of Engineering & Technology,Kalmeshwar, Nagpur | Nagpur | Unaided | – |
| 04193 | K.D.M. Education Society, Vidharbha Institute of Technology,Umred Road ,Nagpur | Nagpur | Unaided | – |
| 04196 | Gurunanak Educational Society&#39;s Gurunanak Institute of Technology, Nagpur | Nagpur | Unaided | – |
| 04679 | Karanjekar College of Engineering & Management, Sakoli | Bhandara | Unaided | – |
| 04766 | Dr. Arun Motghare College of Engineering and Technology | Nagpur | Unaided | – |
| 05121 | K. K. Wagh Institute of Engineering Education and Research, Nashik | Nashik | Unaided | – |
| 05139 | Pravara Rural College of Engineering, Loni, Pravaranagar, Ahmednagar. | Ahilyanagar | Unaided | – |
| 05177 | Matoshri College of Engineering and Research Centre, Eklahare, Nashik | Nashik | Unaided | – |
| 05235 | Late Bhausaheb Hiray Smarnika Samiti Trust Sanchalit Polytechnic, Malegaon, Nashik | Nashik | Unaided | – |
| 05244 | MET&#39;s Institute of Technology Polytechnic, Bhujbal Knowledge City, Adgaon Nashik | Nashik | Unaided | – |
| 05256 | Matoshri Aasarabai Institute of Technology and Research Centre | Nashik | Unaided | – |
| 05263 | Matoshri Education Soceity, Matoshri Institute Of Technology, Dhanore, Nashik | Nashik | Unaided | – |
| 05390 | K.V.N. Naik S. P. Sansth&#39;s Loknete Gopinathji Munde Institute of Engineering Education & Research, Nashik. | Nashik | Unaided | – |
| 05409 | Rajiv Gandhi College of Engineering, At Post Karjule Hariya Tal.Parner, Dist.Ahmednagar | Ahilyanagar | Unaided | – |
| 05413 | Netaji Subhashchandra Bose Edu Trust,Netaji Polytechnic.,Dhule | Dhule | Unaided | – |
| 05682 | Sai College of Engineering and Technology | Nashik | Unaided | – |
| 05686 | Loknete Suhas Dwarkanath Kande College of Engineering Management and Research | Nashik | Unaided | – |
| 06007 | Walchand College of Engineering, Sangli | Sangli | Government-Aided | – |
| 06122 | TSSMS&#39;s Pd. Vasantdada Patil Institute of Technology, Bavdhan, Pune | Pune | Unaided | – |
| 06149 | Siddhant College of Engineering, A/p Sudumbare, Tal.Maval, Dist-Pune | Pune | Unaided | – |
| 06222 | Dattajirao Kadam Technical Education Society&#39;s Textile & Engineering Institute, Ichalkaranji. | Kolhapur | Unaided | – |
| 06271 | Pune Institute of Computer Technology | Pune | Unaided | – |
| 06402 | NEW INSTITUTE OF TECHNOLOGY,KOLHAPUR | Kolhapur | Unaided | – |
| 06444 | Shriram Institute Of Engineering & Technology, (Poly), Paniv | Solapur | Unaided | – |
| 06467 | Swami Vivekanand Institute Of Technology, Solapur | Solapur | Unaided | – |
| 06625 | Universal College of Engineering & Research, Sasewadi | Pune | Unaided | – |
| 06644 | Shri. Ambabai Talim Sanstha&#39;s Sanjay Bhokare Group of Institutes, Miraj | Sangli | Unaided | – |
| 06755 | JSPM Narhe Technical Campus, Pune. | Pune | Unaided | – |
| 06799 | Shivganga Charitable Trust, Sangli Vishveshwarya Technical Campus, Faculty of Diploma Engineering, Patgaon, Miraj | Sangli | Unaided | – |
| 06811 | Sanjay Ghodawat Institute | Kolhapur | Unaided | – |
| 06814 | K.P. Patil Institute ( Polytechnic ), Bhudargad, Dist.Kolhapur | Kolhapur | Unaided | – |
| 16121 | Shri. Anandrao Abitkar College of Engineering, Pal | Kolhapur | Unaided | – |
| 16351 | Vidya Niketan Institute of Engineering & Technology, Lakhewadi | Pune | Unaided | – |
| 16352 | Yashoda Mahadeo Kakade College of Engineering, Talegaon | Pune | Unaided | – |
| 16354 | DNYANVILAS COLLEGE OF ENGINEERING PIMPRI -CHINCHWAD , PUNE | Pune | Unaided | – |
| 16355 | Audyogik Shikshan Mandal&#39;s Nextgen Technical Campus | Pune | Unaided | – |
| 16371 | Kai. Nirmalatai Pingle Institute of Engineering & Management studies | Pune | Unaided | – |
| 16372 | Sawkar Women&#39;s Institute of Technology | Pune | Unaided | – |
| 16373 | SJVPM College of Engineering | Pune | Unaided | – |

### Website did not load (39)

DNS failure, broken HTTPS chain, Cloudflare block or timeout from the crawler. Next: retry later, or collect by hand in a browser.

| Code | College | District | Type | Site tried |
|---|---|---|---|---|
| 01276 | Manav School of Engineering & Technology, Gut No. 1035 Nagpur Surat Highway, NH No. 6 Tal.Vyala, Balapur, Akola, 444302 | Akola | Unaided | <https://www.manavengineering.ac.in> |
| 02015 | PURANMAL LAHOTI GOVERNMENT INSTITUTE OF ENGINEERING AND TECHNOLOGY, LATUR | Latur | Government | <https://www.plgpl.org> |
| 02021 | University Department of Chemical Technology, Aurangabad | Chhatrapati Sambhaji Nagar | Government | <https://bamu.ac.in/en/academicspage/department-of-chemical-technology> |
| 02116 | Matoshri Pratishan&#39;s Group of Institutions (Integrated Campus), Kupsarwadi , Nanded | Nanded | Unaided | <https://mpgin.in> |
| 02136 | Aditya Engineering College , Beed | Beed | Unaided | <https://adityaengineeringcollege.in> |
| 02282 | Mitthulalji Sarada Institute Of Technology, Nalwandi Road, Beed | Beed | Unaided | <https://msiot.in> |
| 02508 | GRAMIN TECHNICAL AND MANAGEMENT CAMPUS NANDED. | Nanded | Unaided | <https://graminnanded.org.in> |
| 02516 | International Centre Of Excellence In Engineering and Management (ICEEM) | Chhatrapati Sambhaji Nagar | Unaided | <https://iceem.ac.in> |
| 02758 | Sant Eknath College of Engineering | Chhatrapati Sambhaji Nagar | Unaided | <https://www.secoengg.org> |
| 03217 | Vighnaharata Trust&#39;s Shivajirao S. Jondhale College of Engineering & Technology, Shahapur, Asangaon, Dist Thane | Thane | Unaided | <https://www.jondhleengg.org> |
| 03224 | Leela Education Society, G.V. Acharya Institute of Engineering and Technology, Shelu, Karjat | Raigad | Unaided | <https://www.gvaiet.org> |
| 03447 | G.M.Vedak Institute of Technology, Tala, Raigad. | Raigad | Unaided | <https://www.gmvit.com> |
| 03462 | VPM&#39;s Maharshi Parshuram College of Engineering, Velneshwar, Ratnagiri. | Ratnagiri | Unaided | <https://www.vpmmpcoe.org/> |
| 03465 | Ideal Institute of Technology, Wada, Dist.Thane | Thane | Unaided | <https://idealwada.com> |
| 03546 | Devi Mahalaxmi College of Engineering and Technology | Thane | Unaided | <https://devimahalaxmicollege.in> |
| 04004 | Government College of Engineering, Chandrapur | Chandrapur | Government | <http://www.gcoec.ac.in/gcoec/> |
| 04190 | M.D. Yergude Memorial Shikshan Prasarak Mandal&#39;s Shri Sai College of Engineering & Technology, Bhadrawati | Chandrapur | Unaided | <https://sscet.in> |
| 05173 | SNJB&#39;s Late Sau. Kantabai Bhavarlalji Jain College of Engineering, (Jain Gurukul), Neminagar,Chandwad,(Nashik) | Nashik | Unaided | <https://snjb.org/engineering/> |
| 05370 | Kedareshwar Gramin Vikas Pratishthan, Samajbhushan Eknathrao Dhakane College, of Engineering, Shevgaon | Ahilyanagar | Unaided | <https://www.dhakanecoe.co.in> |
| 05395 | Ashok Institute of Engineering & Technology | Nashik | Unaided | <https://www.ashokengg.co.in> |
| 05418 | Guru Gobind Singh College of Engineering & Research Centre, Nashik. | Nashik | Unaided | <https://engg.ggsf.edu.in> |
| 05597 | VAMANRAO ITHAPE COLLEGE OF ENGINEERING AND MANAGEMENT | Nashik | Unaided | <https://vicoem.in> |
| 05683 | Saptashrungi College of Engineering and Polytechnic | Nashik | Unaided | <https://www.scoenggap.org> |
| 05688 | MES Institute of Engineering and Technology, sonai | Ahilyanagar | Unaided | <https://mesiet.org> |
| 06138 | Genba Sopanrao Moze Trust Parvatibai Genba Moze College of Engineering,Wagholi, Pune | Pune | Unaided | <https://www.pgmozecoepune.in> |
| 06184 | K. J.&#39;s Educational Institut Trinity College of Engineering and Research, Pisoli, Haveli | Pune | Unaided | <https://www.trinity-autonomous.in> |
| 06276 | MKSSS&#39;s Cummins College of Engineering for Women, Karvenagar,Pune | Pune | Unaided | <http://no.access/> |
| 06308 | Shanti Education Society, A.G. Patil Institute of Technology, Soregaon, Solapur(North) | Solapur | Unaided | <https://www.agpit.edu.in> |
| 06311 | Jayawant Shikshan Prasarak Mandal, Bhivarabai Sawant Institute of Technology & Research, Wagholi | Pune | Unaided | <https://jspmbsiotr.edu.in> |
| 06315 | Sanjeevan Group of Institutions | Kolhapur | Unaided | <http://seti.edu.in/> |
| 06622 | ISBM College Of Engineering Pune | Pune | Unaided | <https://www.isbmcoe.org/> |
| 06632 | Navsahyadri Education Society&#39;s Group of Institutions | Pune | Unaided | <https://navsahyadricoe.com> |
| 06634 | KJEI&#39;s Trinity Academy of Engineering, Yewalewadi, Pune | Pune | Unaided | <https://www.kjei.edu.in/> |
| 06714 | APPASAHEB ALIAS SA.RE.PATIL INSTITUTE OF TECHNOLOGY, Dattanagar Tal-Shirol, Dist Kolhapur | Kolhapur | Unaided | <https://www.srpit.ac.in> |
| 06725 | New Satara Shikshan Sankul,New Satara College of Engineering & Management, Pandharpur | Satara | Unaided | <https://www.nscoem.com> |
| 06803 | Sant Gajanan Maharaj College of Engineering, Gadhinglaj | Kolhapur | Unaided | <https://www.sgmcoe.in> |
| 06815 | DR. G.V.SHINGRE VPS COLLEGE OF ENGINEERING AND TECHNOLOGY, LONAVALA, MAUJE WAKSAI, TAL MAVAL, DIST PUNE | Pune | Unaided | <https://www.vps-cet.com> |
| 06822 | Pimpri Chinchwad Education Trust&#39;s Pimpri Chinchwad College Of Engineering And Research, Ravet | Pune | Unaided | <https://www.pccoer.com/> |
| 06878 | Dr. A. D. Shinde College Of Engineering, Tal.Gadhinglaj, Kolhapur | Kolhapur | Unaided | <https://www.adshindecoe.ac.in> |

### Site found is not the college's own (12)

The site found is a group or trust site, or a different institute. Next: find the college's own page on the group site, then re-crawl.

| Code | College | District | Type | Site tried |
|---|---|---|---|---|
| 01128 | Prof Ram Meghe College of Engineering and Management, Badnera | Amravati | Unaided | <https://prmceam.ac.in/> |
| 02131 | Shree Tuljabhavani College of Engineering, Tuljapur | Dharashiv | Unaided | <https://stbcet.org.in> |
| 03175 | M.G.M.&#39;s College of Engineering and Technology, Kamothe, Navi Mumbai | Raigad | Unaided | <https://www.mgmmumbai.ac.in/> |
| 03188 | Vasantdada Patil Pratishthan&#39;s College Of Engineering and Visual Arts, Sion, Mumbai | Mumbai-City | Unaided | <https://www.pvppcoe.ac.in/> |
| 03470 | YASHWANTRAO BHONSALE INSTITUTE OF TECHNOLOGY | Sindhudurg | Unaided | <https://www.ybit.ac.in> |
| 04302 | Gondia Education Society&#39;s Manoharbhai Patel Institute Of Engineering & Technology, Shahapur, Bhandara | Bhandara | Unaided | <https://www.mietgondia.in> |
| 05124 | Jagadamba Education Soc. Nashik&#39;s S.N.D. College of Engineering & Research, Babulgaon | Nashik | Unaided | <https://sndcoe.ac.in> |
| 06183 | Al-Ameen Educational and Medical Foundation, College of Engineering, Koregaon, Bhima | Pune | Unaided | <https://www.alameencoe.org> |
| 06219 | KSGBS&#39;s Bharat- Ratna Indira Gandhi College of Engineering, Kegaon, Solapur | Solapur | Unaided | <https://www.bigce.in> |
| 06317 | Sharad Institute of Technology College of Engineering, Yadrav(Ichalkaranji) | Kolhapur | Unaided | <https://www.sitcoe.org.in> |
| 06320 | K.J.&#39;s Educational Institute&#39;s K.J.College of Engineering & Management Research, Pisoli | Pune | Unaided | <https://www.kjei.edu.in/kjcoemr/> |
| 06758 | Sahyadri Valley College of Engineering & Technology, Rajuri, Pune. | Pune | Unaided | <https://www.svcet.edu.in> |

