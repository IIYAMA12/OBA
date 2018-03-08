```
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?type (COUNT(?cho) AS ?count) WHERE {
  ?cho dc:type ?type
}
GROUP BY ?type
ORDER BY DESC(?count)
```

```
PREFIX dc: <http://purl.org/dc/elements/1.1/>
SELECT DISTINCT ?type (COUNT(?cho) AS ?count) WHERE {
  ?cho dc:type ?type .
  FILTER EXISTS {?cho dc:type "foto"^^xsd:string .}
}
GROUP BY ?type
ORDER BY DESC(?count)
```

```
#alle bierpullen

PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT ?cho ?title ?img WHERE {
  ?cho dc:type "bierpul"^^xsd:string .
  ?cho dc:title ?title .
  ?cho foaf:depiction ?img .
}
```

```
# alle baarden

PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT ?cho ?title ?img WHERE {
  ?cho dc:type ?type .
  ?cho dc:title ?title .
  ?cho foaf:depiction ?img .
  FILTER REGEX(?title, ' baard ')
}
```

```
# alle afbeeldingen van de Sint Antoniesbreestraat

PREFIX dct: <http://purl.org/dc/terms/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>

SELECT * WHERE {
  ?bbitem dct:spatial <https://adamlink.nl/geo/street/sint-antoniesbreestraat/4096> .
  ?bbitem foaf:depiction ?imgurl .
  ?bbitem dc:type ?type .
}
```

```
# portretten van mensen die bij Ajax gespeeld hebben

PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX owl: <http://www.w3.org/2002/07/owl#>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
PREFIX wd: <http://www.wikidata.org/entity/>

SELECT DISTINCT ?wdid ?person ?item
WHERE {
    SERVICE <https://query.wikidata.org/sparql>{
      ?wdid wdt:P54 wd:Q81888 .
    }
    ?person owl:sameAs ?wdid .
    ?item dc:subject ?person .
}
```

```
# 150 meest afgebeelde gebouwen

PREFIX hg: <http://rdf.histograph.io/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
PREFIX geo: <http://www.opengis.net/ont/geosparql#>

SELECT ?building ?buildingLabel ?wkt (COUNT(DISTINCT ?cho) AS ?count)  WHERE {
    ?building a hg:Building .
    ?building rdfs:label ?buildingLabel .
    ?cho dct:spatial ?building .
    ?building geo:hasGeometry/geo:asWKT ?wkt .
}
GROUP BY ?building ?buildingLabel ?wkt
ORDER BY DESC (?count)
LIMIT 150
```

```
# naar mannen en vrouwen vernoemde straten, op de kaart
# deze query op wikidata draaien!

#defaultView:Map
SELECT ?street ?streetLabel ?layer ?coords
WHERE
{
  ?street wdt:P31 wd:Q79007.
  ?street wdt:P131 wd:Q9899 .
  ?street wdt:P138 ?namedafter .
  ?street wdt:P625 ?coords .
  ?namedafter wdt:P21 ?gender  .
  BIND(IF(?gender = wd:Q6581072, "vrouwelijk","mannelijk") AS ?layer)
  SERVICE wikibase:label { bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }
}
```

```
# alle onderwerpen van posters

PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX foaf: <http://xmlns.com/foaf/0.1/>
SELECT DISTINCT ?postersub (COUNT(?cho) AS ?count)  WHERE {
  ?cho dc:type "Poster."^^xsd:string .
  ?cho dc:subject ?postersub .
  ?cho dc:title ?title .
  ?cho foaf:depiction ?img .
}
GROUP BY ?postersub
ORDER BY DESC(?count)
```
