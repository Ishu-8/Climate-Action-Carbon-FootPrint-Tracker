--
-- PostgreSQL database dump
--

\restrict uveTd8wcZjKx5LK30c74ygbG1PnDBskBXP5i2iQ8gFwKuCE3wZ0KsFmHuhHXSuG

-- Dumped from database version 16.11
-- Dumped by pg_dump version 16.11

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Data for Name: adjustment_factors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.adjustment_factors (id, category, factor_name, multiplier) FROM stdin;
1	peak_hours	peak	1.2
2	peak_hours	off_peak	0.9
3	season	summer	1.15
4	season	winter	1.1
5	season	normal	1
6	traffic	light	1
7	traffic	moderate	1.1
8	traffic	heavy	1.2
9	ac	AC_ON	1.05
10	ac	AC_OFF	1
11	vehicle_age	new	1
12	vehicle_age	old	1.1
13	renewable_usage	solar_enabled	0.7
14	weather	normal	1
15	weather	extreme_heat	1.05
16	peak_hours	peak	1.2
17	peak_hours	off_peak	0.9
18	season	summer	1.15
19	season	winter	1.1
20	season	normal	1
21	meal_source	local	0.9
22	meal_source	imported	1.2
23	cooking_method	raw	0.8
24	cooking_method	gas_stove	1
25	cooking_method	electric_stove	1.1
26	cooking_method	microwave	0.95
27	organic	organic	0.85
28	organic	non_organic	1
\.


--
-- Data for Name: energy_emission_factors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.energy_emission_factors (id, energy_source, emission_factor) FROM stdin;
1	Grid Electricity - India	0.82
2	Solar	0.05
3	Wind	0.02
4	Diesel Generator	0.9
\.


--
-- Data for Name: food_emission_factors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.food_emission_factors (id, meal_type, emission_factor) FROM stdin;
1	Veg Meal	1.5
2	Chicken Meal	2.5
3	Beef Meal	6
4	Milk (1L)	1.2
5	Rice (1kg)	2.7
\.


--
-- Data for Name: transport_emission_factors; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.transport_emission_factors (id, vehicle_type, fuel_type, emission_factor) FROM stdin;
1	Car	Petrol	0.13
2	Car	Diesel	0.15
3	Car	EV	0.02
4	Bike	Petrol	0.05
5	Bus	Diesel	0.08
6	Train	Electric	0.04
\.


--
-- Name: adjustment_factors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.adjustment_factors_id_seq', 28, true);


--
-- Name: energy_emission_factors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.energy_emission_factors_id_seq', 4, true);


--
-- Name: food_emission_factors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.food_emission_factors_id_seq', 5, true);


--
-- Name: transport_emission_factors_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.transport_emission_factors_id_seq', 6, true);


--
-- PostgreSQL database dump complete
--

\unrestrict uveTd8wcZjKx5LK30c74ygbG1PnDBskBXP5i2iQ8gFwKuCE3wZ0KsFmHuhHXSuG

