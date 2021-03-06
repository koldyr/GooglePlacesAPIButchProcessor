namespace com.koldyr.places {

    export class PlacesLoader {
        private placesService: google.maps.places.PlacesService;
        private promise: PromiseFunctions;

        constructor(placesService: google.maps.places.PlacesService) {
            this.placesService = placesService;
        }

        load(brand: string, context: ProcessContext): Promise<Array<Place>> {
            return new Promise<Array<Place>>((resolve: Function, reject: Function) => {

                this.promise = {resolve, reject};

                context.quadrantIndex = 0;
                context.places = [];

                const request = {
                    keyword: brand,
                    bounds: context.nextQuadrant(),
                    type: 'store'
                };

                this.placesService.nearbySearch(request,
                    (results: google.maps.places.PlaceResult[], status: google.maps.places.PlacesServiceStatus, pagination: google.maps.places.PlaceSearchPagination) => {
                        try {
                            this.handleSearchResults(results, status, pagination, context);

                            if (!pagination || !pagination.hasNextPage) {
                                setTimeout(this.nextQuadrantSearch.bind(this), 1, brand, context);
                            }
                        } catch (ex) {
                            if (ex['status'] === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT ||
                                ex['status'] === google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR) {
                                context.status = ResultStatus.REPEAT;
                                resolve(context.places);
                            } else {
                                context.status = ResultStatus.ERROR;
                                reject(context.places);
                            }
                        }
                    });
            });
        }

        private nextQuadrantSearch(brand: string, context: ProcessContext): void {
            if (!context.isRunning) {
                this.promise.resolve(context.places);
                return;
            }

            console.debug(brand, ' - quadr:', context.quadrantIndex, ', count:', context.places.length);

            const request = {
                keyword: brand,
                bounds: context.nextQuadrant(),
                type: 'store'
            };

            this.placesService.nearbySearch(request, (results, status, pagination) => {
                try {
                    this.handleSearchResults(results, status, pagination, context);

                    if (!pagination || !pagination.hasNextPage) {
                        if (context.hasQuadrant()) {
                            setTimeout(this.nextQuadrantSearch.bind(this), 1, brand, context);
                        } else {
                            if (context.places.length > 0) {
                                console.info(brand, 'found', context.places.length, 'places');
                            } else {
                                console.info(brand, 'Completed with', context.places.length, 'places');
                            }
                            context.status = ResultStatus.OK;
                            this.promise.resolve(context.places);
                        }
                    }
                } catch (ex) {
                    if (ex['status'] === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT ||
                        ex['status'] === google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR) {
                        setTimeout(this.nextQuadrantSearch.bind(this), 7000, brand, context);
                    } else {
                        console.error('handleSearchResults:', ex);
                        context.status = ResultStatus.ERROR;
                        this.promise.reject(context.places);
                    }
                }
            });
        }

        private handleSearchResults(results: google.maps.places.PlaceResult[], status: google.maps.places.PlacesServiceStatus,
                                    pagination: google.maps.places.PlaceSearchPagination, context: ProcessContext): void {
            if (status === google.maps.places.PlacesServiceStatus.OK) {
                for (let i = 0; i < results.length; i++) {
                    // createMarker(results[i]);
                    context.places.push(this.createPlace(results[i]));
                }

                if (pagination && pagination.hasNextPage) {
                    pagination.nextPage();
                }
            } else if (status === google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT ||
                status === google.maps.places.PlacesServiceStatus.UNKNOWN_ERROR) {
                const error: Error = new Error();
                error['status'] = status;
                throw error;
            } else if (status === google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                // ignore
            } else {
                console.debug(status.toString());
            }
        }

        private createPlace(result: google.maps.places.PlaceResult): Place {
            return {
                name: result.name,
                location: {lat: result.geometry.location.lat(), lng: result.geometry.location.lng()},
                rating: result.rating,
                placeId: result.place_id,
                address: result.vicinity
            };
        }
    }
}
