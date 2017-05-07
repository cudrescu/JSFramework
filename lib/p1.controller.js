(function() {

    'use strict';

    cristi.controller('P1Controller', {}, [], P1Controller);

    function P1Controller(loadData, dependencies) {
        var data = {
            showSkills: true,
            skills: ["js", "html", "css"]
        };

        var functions = {
            showSkills: function() {
                return data.showSkills;
            },
            stuff: function() {
                alert('stuff');
            }
        };

        cristi.events.register({
            element: '.text',
            name: 'click',
            handler: functions.stuff
        });

        return {
            data: data,
            functions: functions
        }
    }

})();