(function(global) {

    'use strict';

	var simpleJs = {
		router: Router(),
		controller: Controller,
		service: Service,
		httpService: HttpService(),
		templateEngine: TemplateEngine,
        selectors: Selectors(),
        events: Events(),
        component: Component(),
        constant: Constant(),
        bindedObject: BindedObject
	};

	/* error handling TODO: //refactor */
	function handleError(error) {
	    throw new Error(error);
    }

    var bindedElements = [];
    function DataBinder( object_id ) {
        // Create a simple PubSub object
        var pubSub = {
                callbacks: {},

                on: function( msg, callback ) {
                    this.callbacks[ msg ] = this.callbacks[ msg ] || [];
                    this.callbacks[ msg ].push( callback );
                },

                publish: function( msg ) {
                    this.callbacks[ msg ] = this.callbacks[ msg ] || []
                    for ( var i = 0, len = this.callbacks[ msg ].length; i < len; i++ ) {
                        this.callbacks[ msg ][ i ].apply( this, arguments );
                    }
                }
            },

            data_attr = "data-bind-" + object_id,
            message = object_id + ":change",

            changeHandler = function( evt ) {
                var target = evt.target || evt.srcElement, // IE8 compatibility
                    prop_name = target.getAttribute( data_attr );

                if ( prop_name && prop_name !== "" ) {
                    pubSub.publish( message, prop_name, target.value );
                }
            };

        // Listen to change events and proxy to PubSub
        if ( document.addEventListener ) {
            document.addEventListener( "change", changeHandler, false );
        } else {
            // IE8 uses attachEvent instead of addEventListener
            document.attachEvent( "onchange", changeHandler );
        }

        // PubSub propagates changes to all bound elements
        pubSub.on( message, function( evt, prop_name, new_val ) {
            var elements = document.querySelectorAll("[" + data_attr + "=" + prop_name + "]"),
                tag_name;

            for ( var i = 0, len = elements.length; i < len; i++ ) {
                tag_name = elements[ i ].tagName.toLowerCase();

                if ( tag_name === "input" || tag_name === "textarea" || tag_name === "select" ) {
                    elements[ i ].value = new_val;
                } else {
                    elements[ i ].innerHTML = new_val;
                }
            }
        });

        return pubSub;
    }

    function BindedObject( uid ) {
        var binder = new DataBinder( uid ),

            data = {
                attributes: {},

                // The attribute setter publish changes using the DataBinder PubSub
                set: function( attr_name, val ) {
                    this.attributes[ attr_name ] = val;
                    // Use the `publish` method
                    binder.publish( uid + ":change", attr_name, val, this );
                },

                get: function( attr_name ) {
                    return this.attributes[ attr_name ];
                },

                _binder: binder
            };

        // Subscribe to the PubSub
        bindedElements.push({
            uid: uid,
            binder: binder,
            data: data
        });
        /*binder.on( uid + ":change", function( evt, attr_name, new_val, initiator ) {
            if ( initiator !== data ) {
                data.set( attr_name, new_val );
            }
        });*/

        return data;
    }

    function initiateBinding() {
        bindedElements.forEach(function (bindingEntry) {
            bindingEntry.binder.on(bindingEntry.uid + ":change", function( evt, attr_name, new_val, initiator ) {
                if ( initiator !== bindingEntry.data ) {
                    bindingEntry.data.set( attr_name, new_val );
                }
            });
        });
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
            simpleJs.events.clear();

            // get route by url:
            var path = location.hash.slice(1) || '/';
            var route = routes[path];
            if(!route) {
                handleError('Could not determine route for path ' + path);
            }

            // get element to render the view
            var element = simpleJs.selectors.query.byTag('body')[0];

            if(path && element && route) {
                renderTemplate(route.template, route.controller, element);
                currentRoute = route;
            }
        }

        function fireDocumentReadyEvent() {
            var evt = new CustomEvent('document-ready', {});
            window.dispatchEvent(evt);
        }

        function renderTemplate(templateUrl, templateController,  element) {
		    //get the template html
            HttpService().get(templateUrl)
                .success(function(response) {
                    //render template
                    TemplateEngine(response.data, templateController.definition(templateController.loadData, templateController.dependencies), function(html) {
                        element.innerHTML = html;
                        simpleJs.events.start();
                        initiateBinding();
                        fireDocumentReadyEvent();
                    });
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
    function TemplateEngine(html, options, callback) {

        if(!html) {
            handleError('Html template to be rendered can\'t be empty');
        }

        function renderComponents(html, callback) {
            var componentReg = /<component name="\w+"\/>/g;
            var match;
            var components = [];
            if (html.match(componentReg)) {
                while (match = componentReg.exec(html)) {
                    var componentName = match[0].substring(match[0].indexOf("name=\"") + 6, match[0].lastIndexOf("\""));
                    var component = simpleJs.component.get(componentName);
                    components.push({match: match[0], component: component});
                }
            }
            if(components.length == 0) {
                callback(html);
                return;
            }
            function renderComponent(index) {
                if(index == components.length) {
                    callback(html);
                    return;
                }
                getComponent(components[index].component.template, components[index].component.controller, function (componentHTML) {
                    html = html.replace(components[index].match, componentHTML);
                    renderComponent(index+1);
                });
            }
            renderComponent(0);
        }

        function getComponent(compUrl, compController, callback) {
            //get the template html
            HttpService().get(compUrl)
                .success(function(response) {
                    //render template
                    var controllerData = compController();
                    TemplateEngine(response.data, controllerData, function(html) {
                        callback(html);
                    });
                })
                .failure(function(response) {
                    handleError('Could not load template: ' + compUrl + '. Got response: ' + response);
                    callback("");
                })
        }

        //handle components
        renderComponents(html, function(html) {

            var re = /<%([^%>]+)?%>/g, reExp = /(^( )?(if|for|else|switch|case|break|{|}))(.*)?/g, code = 'var r=[];\n';
            var cursor = 0, match;

            var add = function (line, js) {
                js ? (code += line.match(reExp) ? line + '\n' : 'r.push(' + line + ');\n') :
                    (code += line != '' ? 'r.push("' + line.replace(/"/g, '\\"') + '");\n' : '');
                return add;
            };

            while (match = re.exec(html)) {
                var txt = html.slice(cursor, match.index);
                add(txt)(match[1], true);
                cursor = match.index + match[0].length;
            }

            add(html.substr(cursor, html.length - cursor));
            code += 'return r.join("");';

            callback(new Function(code.replace(/[\r\t\n]/g, '')).apply(options));
        });

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
            var body = '';

            if (xhttp.response) {
                body = xhttp.response;
            } else {
                body = xhttp.responseText || xhttp.responseXML;
            }

            try {
                return JSON.parse(body)
            }
            catch(e) {
                return body;
            }
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
		    if(dependency !== 'watch' && dependency !== 'unwatch') {
                if (!services.hasOwnProperty(dependency)) {
                    handleError('Could not inject dependency service: ' + dependency);
                }
                injectedServices[dependency] = services[dependency].definition();
            }
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
                var elements = simpleJs.selectors.query.all(event.element);
                elements.forEach(function (element) {
                    element.addEventListener(event.name, event.handler, event.capture == null ? false : event.capture);
                });
            });
        }

        function remove(element, name) {
            events.forEach(function (event) {
                if(event.element === element && event.name === name) {
                    var elements = simpleJs.selectors.query.all(element);
                    elements.forEach(function (element) {
                        element.removeEventListener(event.name, event.handler);
                    });
                }
            });
        }

        function clear() {
            events = [];
        }

        function documentReady(callback) {
            window.addEventListener('document-ready', function (e) {
                callback(e);
            });
        }

        return {
            register: register,
            start: start,
            remove: remove,
            clear: clear,
            documentReady: documentReady
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

        return {
            register: register,
            get: get
        }
    }

    /* define constants */
    function Constant() {

        var constants = {};

        function put(key, value) {
            if(!key) {
                handleError('key value for constant can\'t be null');
            }
            constants[key] = value;
        }

        function get(key) {
            return constants[key];
        }

        function remove(key) {
            constants[key] = undefined;
        }

        return {
            put: put,
            remove: remove,
            get: get
        }
    }

    global.simpleJs = simpleJs;

})(window);