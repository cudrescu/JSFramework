(function() {

    'use strict';

    simpleJs.controller('P1Controller', {}, [], P1Controller);

    function P1Controller(loadData, dependencies) {
        var data = {
            showSkills: true,
            skills: []
        };

        simpleJs.httpService.get('/data.json')
            .success(function(response) {
                console.log(response);
                data.skills = response.data.values;
            });

        var functions = {
            showSkills: function() {
                return data.showSkills;
            },
            stuff: function() {
                alert('stuff');
            },
            showAge: function () {
                alert(user.attributes.age);
            }
        };

        simpleJs.events.register({
            element: '.text',
            name: 'click',
            handler: functions.stuff
        });

        var user = simpleJs.bindedObject("age");
        user.set("age", 0);

        simpleJs.events.register({
            element: '#showAge',
            name: 'click',
            handler: functions.showAge
        });

        simpleJs.events.documentReady(function(ev) {
           console.log("test" + ev);
        });


        return {
            data: {
                static: data,
                binded: user.attributes
            },
            functions: functions
        }
    }

    simpleJs.component.register("test", {
        template: "/templates/c1.tpl.html",
        controller: function() {

        }
    });

    simpleJs.component.register("comp", {
        template: "/templates/c2.tpl.html",
        controller: function() {
            simpleJs.events.register({
                element: '.asd',
                name: 'mouseover',
                handler: function() {
                    var color = new Date().getMilliseconds()%2 == 0 ? "red" : "black";
                    simpleJs.selectors.query.first('.asd').setAttribute("style", "color:" + color + ";");
                }
            });

            var messageData = new simpleJs.bindedObject('bindTest');
            messageData.set("message", 'IT\'S ME, MARIO !!!');

            setTimeout(function() {
                messageData.set("message", 'IT\'S ME, LUIGI !!!');
            }, 2000);

            return {
                data: {
                    binded: {
                        messageData: messageData.attributes
                    }
                }
            }
        }
    })

})();