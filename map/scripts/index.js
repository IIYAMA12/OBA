const app = {
    init() {
        this.map.init();
    },
    map: {
        init () {
            this.load.map();
        },

        layers: [],
        streetIndex : 0,

        load: {
            data (lng, lat) {

                ////////////////////////////
                // sprankelende query !!! //

                const sparqlquery = `
                    PREFIX hg: <http://rdf.histograph.io/>
                    PREFIX geo: <http://www.opengis.net/ont/geosparql#>
                    PREFIX rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>

                    SELECT DISTINCT ?street ?size ?streetgeom ?streetName ?hasEarliestBeginTimeStamp  WHERE {
                        ?street rdf:type hg:Street .
                        ?street geo:hasGeometry/geo:asWKT ?wkt .
                        ?street <http://www.w3.org/2000/01/rdf-schema#label> ?streetName .
                        BIND (bif:st_geomfromtext(?wkt) as ?streetgeom) .
                        BIND (bif:st_geomfromtext("POINT(` + lng + ` ` + lat + `)") as ?point) .

                        FILTER (!REGEX(?wkt, 'Array')) .

                        BIND(bif:st_get_bounding_box(?streetgeom) as ?boundingBox ) .
                        BIND(((bif:ST_XMax (?boundingBox) - bif:ST_XMin(?boundingBox)) + (bif:ST_YMax (?boundingBox) - bif:ST_YMin(?boundingBox)))  as ?size) .

                        OPTIONAL {
                            ?street <http://semanticweb.cs.vu.nl/2009/11/sem/hasEarliestBeginTimeStamp> ?hasEarliestBeginTimeStamp .
                        } .


                        FILTER (bif:st_may_intersect (?point, ?streetgeom, 0.006)) .



                    }
                    ORDER BY (?size)
                    LIMIT 500
                `;

                // FILTER(?size < "0.001"^^xsd:double) .
                // FILTER(?size > "0.0003"^^xsd:double)
                // BIND(bif:GeometryType(?streetgeom) as ?streetDatatype) .


                //                             bind (bif:st_geomfromtext("POINT(4.921534 52.358119)") as ?point) .
                console.log(sparqlquery);

                ///////////////////////////////////////
                // encode to uri and prepare the url //
                const encodedquery = encodeURIComponent(sparqlquery);

                const queryurl = 'https://api.data.adamlink.nl/datasets/AdamNet/all/services/hva2018/sparql?default-graph-uri=&query=' + encodedquery + '&format=application%2Fsparql-results%2Bjson&timeout=0&debug=on';

                //updated one: https://api.data.adamlink.nl/datasets/AdamNet/all/services/endpoint/sparql

                ////////////////////
                // Fetch the data //

                // const self = this;

                fetch(queryurl)
                .then((resp) => resp.json()) // transform the data into json
                .then(function(data) {
                    app.map.render(app.map.filter(data));
                })
                .catch(function(error) {
                    // if there is any error you will catch them here
                    console.error(error);
                });
            },
            map () {
                mapboxgl.accessToken = 'pk.eyJ1IjoiaWl5YW1hIiwiYSI6ImNqZWZxM3AwOTFoMTgycXBrZWo5NGF6eWoifQ.8bABDvjASinWudt00f0Oxg';
                console.log("make map melement");
                app.map.element = new mapboxgl.Map({
                    container: 'map',
                    // style: 'mapbox://styles/mapbox/dark-v9',
                    style: "mapbox://styles/iiyama/cjehnbdnk33n52rqwj0q1xtkj",
                    center: [4.899431, 52.379189],
                    zoom: 14
                });
                app.map.element.addControl(new MapboxGeocoder({
                    accessToken: mapboxgl.accessToken
                }));
            }
        },

        filter (data) {
            const results = data.results;
            let bindings = results.bindings;

            bindings = bindings.filter(function (d) {
                if (d != undefined && d.size != undefined && d.size.value != undefined) {
                    return true;
                }
                return false;
            });

            bindings = bindings.filter(function (d) {
                return d.size.value < 0.006;
            });

            results.bindings = bindings;
            return data;
        },

        render (data) {
            const results = data.results;
            const bindings = results.bindings;




            const minSize = bindings.reduce(function (acc, cur, index) {
                return Math.min(cur.size.value, acc );
            }, Infinity);

            const maxSize = bindings.reduce(function (acc, cur, index) {
                return Math.max(cur.size.value, acc );
            }, -Infinity);




            ////////////////////////
            // Re-use-able object //
            //* Which will increase the load speed

            const reUseAbleLayerData = {
                "id": null,
                "type": "line",
                "interactive": true,
                "source": {
                    "type": "geojson",
                    "data": {
                        "type": "Feature",
                        "properties": {
                            "customStreet": true
                        },
                        "geometry": {
                            "type": "LineString",
                            "coordinates": null
                        }
                    }
                },
                "layout": {
                    "line-join": "round",
                    "line-cap": "round"
                },
                "paint": {
                    "line-color": "white",
                    "line-width": 5, // 5
                    "line-color-transition": {
                      "duration": 700,
                      "delay": 0
                    }
                }
            };

            // dynamic components //
            const dynamicObjects = {
                geometry: reUseAbleLayerData.source.data.geometry,
                paint: reUseAbleLayerData.paint,
                properties: reUseAbleLayerData.source.data.properties
            };


            ///////////////////////
            // clean up old data //
            if (app.map.element != undefined) {
                // console.log(app.map.element);


                const layers =  app.map.layers;
                // console.log(layers);
                for (var i = 0; i < layers.length; i++) {
                    app.map.element.removeLayer(layers[i].id);
                }
                app.map.layers = [];
            }

            for (let i = 0; i < bindings.length; i++) {
                const binding = bindings[i];
                if (binding.streetgeom != undefined) {

                    const size = binding.size.value;
                    let street = binding.streetgeom.value;
                    if (street != undefined) {

                        if (street.includes("MULTILINESTRING((") || street.includes("LINESTRING(")) {

                            /////////////////////////
                            // prepare for GEOJSON //

                            street = street.replace("MULTILINESTRING((", "");
                            street = street.replace("LINESTRING(", "");
                            street = street.replace(")", "");
                            const pointsAsString  = street.split(",");


                            let points = pointsAsString.map(function (d) {
                                const point = d.split(" ");
                                point[0] = parseFloat(point[0]);
                                point[1] = parseFloat(point[1]);
                                return point;
                            });

                            // check for corrupted points
                            points = points.filter(function (d) {
                                return typeof(d[0]) == "number" && !isNaN(d[0]) && typeof(d[1]) == "number" && !isNaN(d[1]);
                            });


                            ////////////////
                            // apply data //
                            const layerId = "street:" + this.streetIndex;
                            // console.log(layerId);
                            reUseAbleLayerData.id = layerId;
                            this.streetIndex++;

                            dynamicObjects.geometry.coordinates = points;

                            // const factor = (size - minSize) / (maxSize - minSize);
                            // dynamicObjects.paint["line-color"] = app.utility.rgbToHex(Math.floor(factor * 200), Math.floor((1 - factor) * 200), 0);

                            dynamicObjects.properties.streetName = binding.streetName;

                            // console.log(binding.street);
                            if (binding.street != undefined)  { // && typeof(binding.street) == "string")
                                console.log("uri", typeof(binding.street));
                                dynamicObjects.properties.uri = binding.street; //
                            }

                            if (binding.hasEarliestBeginTimeStamp != undefined)  {

                                dynamicObjects.properties.hasEarliestBeginTimeStamp = binding.hasEarliestBeginTimeStamp; //
                            }




                            ///////////////
                            // add layer //

                            app.map.element.addLayer(reUseAbleLayerData);

                            const layers =  app.map.layers;
                            layers[layers.length] = {id: layerId};

                        } else {
                            console.error("Unknown geo data");
                        }
                    }
                }
            }
        }
    },
    utility: {
        componentToHex(c) {
            var hex = c.toString(16);
            return hex.length == 1 ? "0" + hex : hex;
        },
        rgbToHex(r, g, b) {
            return "#" + app.utility.componentToHex(r) + app.utility.componentToHex(g) + app.utility.componentToHex(b);
        }
    }
};




window.addEventListener("load", ((e) => {
    console.log("loaded");
    if (mapboxgl != undefined) {
        app.init();
        const initialMapPoint = [4.899431, 52.379189];
        app.map.load.data(initialMapPoint[0], initialMapPoint[1]);



        // console.log("element", app.map.element);
        const map = app.map;

        // disable double click zoom
        map.element.doubleClickZoom.disable();

        let focusedOnId;
        let dialogBindings = [];

        map.element.on("dblclick", function (e) {
            map.load.data(e.lngLat.lng, e.lngLat.lat);
            dialogBindings = [];
        });


        const showDialog = function (e) {

            const dialogElement = document.querySelector("body > dialog");
            if (dialogElement != undefined) {
                const id = this.id;
                if (id != undefined && id != "") {
                    const index = Number(id.replace("image-information-", ""));
                    if (index != undefined) {

                        const binding = dialogBindings[index];
                        if (binding != undefined) {
                            dialogElement.classList.remove("hidden");
                            dialogElement.querySelector("img").src = binding.img.value;
                            dialogElement.querySelector("img").alt = binding.img.value;

                            const figcaption = dialogElement.querySelector("figcaption");

                            figcaption.innerHTML = "";

                            if (binding.creator != undefined && binding.creator.value != undefined) {
                                const textNode = document.createTextNode("Author: " + binding.creator.value);
                                const paragraph = document.createElement("p");
                                paragraph.append(textNode);
                                figcaption.append(paragraph);
                            }

                            if (binding.subject != undefined && binding.subject.value != undefined && binding.subject.type != "uri") {
                                const textNode = document.createTextNode("Subject: " + binding.subject.value);
                                const paragraph = document.createElement("p");
                                paragraph.append(textNode);
                                figcaption.append(paragraph);
                            }

                            if (binding.startYear != undefined && binding.startYear.value != undefined && binding.subject.type != "uri") {
                                const textNode = document.createTextNode("Genomen op: " + binding.startYear.value);
                                const paragraph = document.createElement("p");
                                paragraph.append(textNode);
                                figcaption.append(paragraph);
                            }
                        }
                    }
                }
            }
        };

        const onImageLoad = function () {
            this.removeEventListener("load", onImageLoad);
            this.classList.add("loaded");
        };


        document.querySelector("[name=\"close-dialog\"]").addEventListener("click", function () {
            const dialogElement = document.querySelector("body > dialog");
            if (dialogElement != undefined) {
                dialogElement.classList.add("hidden");
            }
        });

        const setMapInformationFromPoint = function (point) {
            var features = map.element.queryRenderedFeatures(point);
            if (features != undefined && features.length > 0) {

                let requestingContent = false;
                for (let i = 0; i < features.length; i++) {

                    const feature = features[i];
                    if (feature.properties != undefined) {
                        if (feature.properties.customStreet) {

                            if (feature.properties.uri != undefined && feature.layer != undefined) {
                                if (!requestingContent) {
                                    dialogBindings = [];
                                    requestingContent = true;

                                    // do not request for the same layer every cursor movement
                                    if (focusedOnId !== feature.layer.id) {
                                        if (focusedOnId != undefined) { // defocus effect
                                            map.element.setPaintProperty(focusedOnId, "line-color", "white");
                                        }

                                        focusedOnId = feature.layer.id;

                                        const mapInformationContainer = document.getElementById('map-information');


                                        mapInformationContainer.innerHTML = "";
                                        map.element.setPaintProperty(feature.layer.id, "line-color", "orange");



                                        const sparqlquery = `
                                            PREFIX dct: <http://purl.org/dc/terms/>
                                            PREFIX foaf: <http://xmlns.com/foaf/0.1/>

                                            SELECT ?item ?img ?creator ?subject ?startYear WHERE {
                                                ?item dct:spatial <` + JSON.parse(feature.properties.uri).value + `>  .
                                                ?item foaf:depiction ?img .
                                                optional {
                                                    ?item <http://purl.org/dc/elements/1.1/creator> ?creator .
                                                }
                                                optional {
                                                    ?item <http://purl.org/dc/elements/1.1/description> ?description .
                                                }
                                                optional {
                                                    ?item <http://purl.org/dc/elements/1.1/subject> ?subject .
                                                }
                                                optional {
                                                    ?item <http://semanticweb.cs.vu.nl/2009/11/sem/hasBeginTimeStamp> ?startYear .
                                                }
                                            }
                                            ORDER BY DESC(?startYear)
                                            LIMIT 100

                                        `;


                                        const encodedquery = encodeURIComponent(sparqlquery);

                                        const queryurl = 'https://api.data.adamlink.nl/datasets/AdamNet/all/services/endpoint/sparql?default-graph-uri=&query=' + encodedquery + '&format=application%2Fsparql-results%2Bjson&timeout=0&debug=on';

                                        const headerTitle = JSON.parse(feature.properties.streetName).value;
                                        const streetNameNode = document.createTextNode(headerTitle);
                                        const header = document.createElement("h2");
                                        header.appendChild(streetNameNode);
                                        mapInformationContainer.appendChild(header);


                                        if (feature.properties.hasEarliestBeginTimeStamp != undefined) {
                                            const hasEarliestBeginTimeStamp = JSON.parse(feature.properties.hasEarliestBeginTimeStamp).value;
                                            const timeElement = document.createElement("time");
                                            const time = document.createTextNode("Startjaar: " + hasEarliestBeginTimeStamp);
                                            timeElement.appendChild(time);

                                            const timeContainer = document.createElement("p");
                                            timeContainer.setAttribute("id", "begin-street-year");
                                            timeContainer.appendChild(timeElement)

                                            mapInformationContainer.appendChild(timeContainer);
                                        }

                                        if (mapInformationContainer.classList.contains("mobile-information-hidden")) {
                                            mapInformationContainer.classList.remove("mobile-information-hidden");
                                        }

                                        // for mobile move search input
                                        const searchBarContainer = document.querySelector('.mapboxgl-ctrl-geocoder');
                                        if (!searchBarContainer.classList.contains("information-box-open")) {
                                            searchBarContainer.classList.add("information-box-open");
                                        }

                                        // add loader
                                        const loader = document.createElement("div");
                                        loader.classList.add("loader");
                                        mapInformationContainer.appendChild(loader);

                                        fetch(queryurl)
                                        .then((resp) => resp.json()) // transform the data into json
                                        .then(function(data) {

                                            mapInformationContainer.removeChild(loader);

                                            const results = data.results;
                                            const bindings = results.bindings;
                                            if (bindings.length > 0) {

                                                if (mapInformationContainer != undefined) {
                                                    console.log("mapInformationContainer");


                                                    if (focusedOnId !== feature.layer.id) {
                                                        map.element.setPaintProperty(feature.layer.id, "line-color", "white");
                                                    } else {
                                                        map.element.setPaintProperty(feature.layer.id, "line-color", "orange");






                                                        const fragment = document.createDocumentFragment();


                                                        const list = document.createElement("ul");

                                                        // mobile only
                                                        dialogBindings = bindings;

                                                        for (let i = 0; i < bindings.length; i++) {
                                                            const binding = bindings[i];

                                                            const listItem = document.createElement("li");

                                                            const figure = document.createElement("figure");
                                                            const image = document.createElement("img");

                                                            image.src = binding.img.value;
                                                            image.alt = binding.img.value;
                                                            // console.log("CHECK THIS", binding.item.value);
                                                            const figcaption = document.createElement("figcaption");
                                                            if (binding.creator != undefined && binding.creator.value != undefined) {
                                                                const textNode = document.createTextNode("Auteur: " + binding.creator.value);
                                                                const paragraph = document.createElement("p");
                                                                paragraph.append(textNode);
                                                                figcaption.append(paragraph);
                                                            }


                                                            if (binding.subject != undefined && binding.subject.value != undefined && binding.subject.type != "uri") {
                                                                const textNode = document.createTextNode("Onderwerp: " + binding.subject.value);
                                                                const paragraph = document.createElement("p");
                                                                paragraph.append(textNode);
                                                                figcaption.append(paragraph);
                                                            }
                                                            // console.log(binding.hasEarliestBeginTimeStamp);
                                                            //
                                                            if (binding.startYear != undefined && binding.startYear.value != undefined && binding.subject.type != "uri") {
                                                                const textNode = document.createTextNode("Genomen op: " + binding.startYear.value);
                                                                const paragraph = document.createElement("p");
                                                                paragraph.append(textNode);
                                                                figcaption.append(paragraph);
                                                            }



                                                            listItem.setAttribute("id", "image-information-" + i);

                                                            listItem.addEventListener("click", showDialog);
                                                            image.addEventListener("load", onImageLoad);

                                                            figure.appendChild(image);
                                                            figure.appendChild(figcaption);

                                                            listItem.appendChild(figure);
                                                            list.append(listItem)
                                                        }
                                                        fragment.append(list)
                                                        mapInformationContainer.appendChild(fragment);
                                                    }
                                                }
                                            } else {
                                                console.log("no bindings");
                                                // map.element.setPaintProperty(feature.layer.id, "line-color", "rgb(150,150,150)");
                                            }
                                        })
                                        .catch(function(error) {
                                            mapInformationContainer.removeChild(loader);
                                            map.element.setPaintProperty(feature.layer.id, "line-color", "rgb(150,150,150)");
                                            // if there is any error you will catch them here
                                            console.error(error);
                                        });
                                    }
                                    return true; // experimental return
                                }
                            } else if (feature.layer != undefined) {
                                map.element.setPaintProperty(feature.layer.id, "line-color", "rgb(150,150,150)");
                            }
                        } else {
                            console.log("no correct street");
                        }
                    }
                }
            }
            return false;
        };

        (function () {
            setTimeout(function () {
                if (focusedOnId == undefined) {
                    console.log("use fake point");
                    const fakePointData = [[initialMapPoint[0] - 1000, initialMapPoint[1] - 1000], [initialMapPoint[0] + 1000, initialMapPoint[1] + 1000]];
                    // const features = map.queryRenderedFeatures(fakePointData);
                    setMapInformationFromPoint(fakePointData);
                }
            }, 9000)

        }) ();



        map.element.on("click", function (e) {
            setMapInformationFromPoint(e.point);
        });

        // https://www.mapbox.com/mapbox-gl-js/example/queryrenderedfeatures/
    } else {
        console.error("Can't find mapboxgl");
    }
}));
