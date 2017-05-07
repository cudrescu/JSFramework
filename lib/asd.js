(function() {

	cristi = {

		router: Router(),
		controller: Controller,
		service: Service,
		httpService: HttpService(),
		templateEngine: TemplateEngine,
        selectors: Selectors(),
        events: Events()
	};

	/* error handling TODO: //refactor */
	function handleError(error) {
	    throw new Error(error);
    }

	/* router definition */
	function Router() {

        var routes = {};
        var currentRoute;

        function current() {
            return currentRoute;
        }

        function route(config) {
            if(!config) {
                handleError('A configuration object must be specified as a parameter to the route function');
            }
            if(!config.path || !config.template) {
                handleError('The path and templateUrl must be specified on the route configuration');
            }

            routes[config.path] = {
                template: config.template,
                controller: controllers[config.controller]
            }

		}

		function router() {

            //clear events
            cristi.events.clear();

            // get route by url:
            var path = location.hash.slice(1) || '/';
            var route = routes[path];
            if(!route) {
                handleError('Could not determine route for path ' + path);
            }

            // get element to render the view
            var element = cristi.selectors.query.byTag('body')[0];

            if(path && element && route) {
                renderTemplate(route.template, route.controller, element);
                currentRoute = route;
            }
        }

        function renderTemplate(templateUrl, templateController,  element) {
		    //get the template html
            HttpService().get(templateUrl)
                .success(function(response) {
                    //render template
                    element.innerHTML = TemplateEngine(response.data, templateController.definition(templateController.loadData, templateController.dependencies));
                    cristi.events.start();
                })
                .failure(function(response) {
                    handleError('Could not load template: ' + templateUrl + '. Got response: ' + response);
                })
        }

        // Listen on hash change:
        window.addEventListener('hashchange', router);

		// Listen on page load:
        window.addEventListener('load', router);

        return {
            route: route,
            current: current
        };

	}

	/* templating engine */
    function TemplateEngine(html, options) {
        if(!html) {
            handleError('Html template to be rendered can\'t be empty');
        }
        var re = /<%([^%>]+)?%>/g, reExp = /(^( )?(if|for|else|switch|case|break|{|}))(.*)?/g, code = 'var r=[];\n';
        var cursor = 0, match;
        var add = function(line, js) {
            js? (code += line.match(reExp) ? line + '\n' : 'r.push(' + line + ');\n') :
                (code += line != '' ? 'r.push("' + line.replace(/"/g, '\\"') + '");\n' : '');
            return add;
        };
        while(match = re.exec(html)) {
            add(html.slice(cursor, match.index))(match[1], true);
            cursor = match.index + match[0].length;
        }
        add(html.substr(cursor, html.length - cursor));
        code += 'return r.join("");';
        return new Function(code.replace(/[\r\t\n]/g, '')).apply(options);
    }

	/* http service definition */
	function HttpService() {

		function getDefaultOptions() {
			return {
				async: true,
				withCredentials: false,
				credentials: {}
			}
		}

		function getResponseBody(xhttp) {
            var body = undefined;

            if (xhttp.response) {
                body = xhttp.response;
            } else {
                body = xhttp.responseText || xhttp.responseXML;
            }

            return body;
		}

		function request(url, method, headers, options, data) {
		    if(!url) {
		        handleError('Request Url must be specified');
            }
            var aborted = false;
            var successCallback;
            var failureCallback;
            options = options || getDefaultOptions();
            var xhttp = new XMLHttpRequest();
            if(headers) {
                for(var i = 0; i < headers.length; i++) {
                    xhttp.setRequestHeader(headers[i].key, headers[i].value);
                }
            }

            if(options.withCredentials) {
                xhttp.open(method, url, options.async, options.credentials.user, options.credentials.password);
            } else {
                xhttp.open(method, url, options.async);
            }

            if(method == "GET" || method == "DELETE") {
                xhttp.send();
            } else {
            	xhttp.send(data);
			}

            xhttp.onreadystatechange = function() {
                if(aborted) return;
                var response = {};
                if (this.readyState == 4) {
                    response = {
                        uri: url,
                        status: xhttp.status,
                        headers: xhttp.getAllResponseHeaders(),
                        data: getResponseBody(xhttp)
                    };
                    if (this.status >= 200 && this.status < 300) {
                        successCallback(response);
                    } else {
                        failureCallback(response);
                    }
                }
            };

            var response = {
                abort: function(callback) {
                    xhttp.abort();
                    aborted = true;
                    if(callback)
                        callback();
                    return response;
                },
                success: function(callback) {
                    successCallback = callback;
                    return response;
                },
                failure: function(callback) {
                    failureCallback = callback;
                    return response;
                }
            };

            return response;
		}

		function get(url, headers, options) {
			return request(url, "GET", headers, options);
		}

        function post(url, data, headers, options) {
            return request(url, "POST", headers, options, data);
        }

        function put(url, data, headers, options) {
            return request(url, "PUT", headers, options, data);
        }

        function remove(url, headers, options) {
            return request(url, "DELETE", headers, options);
        }

		return {
			get: get,
			post: post,
			put: put,
			delete: remove
		}
	}

    /* selectors definition */
    function Selectors() {

        return {
            query: {
                byId: selectById,
                byClass: selectByClass,
                byAttribute: selectByAttribute,
                byTag: selectByTag,
                all: selectAll,
                first: selectFirst,
                last: selectLast
            }
        };

        function selectById(elementId) {
            if(elementId) {
                return document.getElementById(elementId);
            }
            return null;
        }

        function selectByClass(className) {
            if(className) {
                return document.getElementsByClassName(className);
            }
            return [];
        }

        function selectByAttribute(name, value) {
            if(name) {
                var selector = value ? '[' + name + '="' + value + '"]' : '[' + name + ']';
                return document.querySelector(selector);
            }
            return null;
        }

        function selectByTag(tagName) {
            if(tagName) {
                return document.getElementsByTagName(tagName);
            }
            return [];
        }

        function selectAll(selector) {
            if(selector) {
                return document.querySelectorAll(selector);
            }
            return [];
        }

        function selectFirst(selector) {
            if(selector) {
                return document.querySelector(selector);
            }
            return null;
        }

        function selectLast(selector) {
            if(selector) {
                var elements = document.querySelectorAll(selector);
                if(elements && elements.length != 0) {
                    return elements[elements.length - 1];
                }
            }
            return null;
        }
    }

	/* controller definition */
	var controllers = {};
	function Controller(name, loadData, dependencies, definition) {
        var injectedServices = {};

		for(var dependency in dependencies) {
			if(!services.hasOwnProperty(dependency)) {
                handleError('Could not inject dependency service: ' + dependency);
            }
            injectedServices[dependency] = services[dependency].definition();
		}

		controllers[name] = {
		    definition: definition,
            loadData: loadData,
            dependencies: injectedServices
        };
	}

	/* service definition */
	var services = {};
	function Service(name, definition) {
		services[name] = {
		    definition: definition
        }
	}

    /* event handling */
    function Events() {

        var events = [];

        function register(event) {
            events.push(event);
        }

        function start() {
            events.forEach(function (event) {
                var elements = cristi.selectors.query.all(event.element);
                elements.forEach(function (element) {
                    element.addEventListener(event.name, event.handler, event.capture == null ? false : event.capture);
                });
            });
        }

        function remove(element, name) {
            events.forEach(function (event) {
                if(event.element === element && event.name === name) {
                    var elements = cristi.selectors.query.all(element);
                    elements.forEach(function (element) {
                        element.removeEventListener(event.name, event.handler);
                    });
                }
            });
        }

        function clear() {
            events = [];
        }

        return {
            register: register,
            start: start,
            remove: remove,
            clear: clear
        }
    }

    /* component handling */
    function Component() {

        var components = {};

        function register(name, component) {
            components[name] = component;
        }

        function get(name) {
            return components[name];
        }

    }


})();