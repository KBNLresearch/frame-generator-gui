/*
 * Frame Generator GUI
 *
 * Copyright (C) 2016 Juliette Lonij, Koninklijke Bibliotheek -
 * National Library of the Netherlands
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 */

//var url = 'http://localhost:8091'
var url = '../frame-generator/';

$(function() {

    $('#window_size').selecter();
    $('#window_direction').selecter();

    var json = $.parseJSON(dummy_data)
    draw(transform(json));

    $('#doc_files').change(function() {
        check_files();
    });

    $('form').submit(function(e) {
        e.preventDefault();
        if (!check_files()) { return; }

        $('#generate').prop('disabled', true);
        $('.alert').html('<p>Processing documents. Please wait, as this may \
            take some time.</p>').show();

        var data = new FormData(this);
        var fileSelect = document.getElementById('doc_files');
        var files = fileSelect.files;

        for (var i = 0; i < files.length; i++) {
            if (/.txt$/.test(files[i].name) || /.json$/.test(files[i].name)) {
                data.append('doc_files[]', files[i], files[i].name);
            }
        }

        $.ajax({
            type: 'POST',
            url: url,
            processData: false,
            contentType: false,
            data: data
        })
        .done(function(data) {
            console.log(data);
            var json = $.parseJSON(data)
            if (json['error']) {
                $('.alert').html('<p>Error processing documents.</p>');
                return;
            }
            graph_data = transform(json);
            draw(graph_data);
            $('.alert').hide();
        })
        .fail(function() {
            $('.alert').html('<p>Error processing documents.</p>');
        })
        .always(function() {
            $('#generate').prop('disabled', false);
        });
    });

});

function check_files() {

    var fileSelect = document.getElementById('doc_files');
    var files = fileSelect.files;

    if (files.length == 0) {
        $('.alert').html('<p>No files uploaded. Please upload your \
            document files using the Upload files button.</p>').show();
        return false;
    }
    if (files.length > 5) {
        $('.alert').html('<p>Too many files uploaded. Please do not \
            upload more than 5 document files at a time.</p>').show();
        return false;
    }
    for (var i = 0; i < files.length; i++) {
        if (/.txt$/.test(files[i].name) || /.json$/.test(files[i].name)) {
            // data.append('doc_files[]', files[i], files[i].name);
        } else {
            $('.alert').html('<p>Wrong file type uploaded. Please upload \
                only plain text files with .txt extension.</p>').show();
            return false;
        }
    }

    $('.alert').html('<p>Files uploaded. Use the Generate button to \
        generate frames.</p>').show();

    return true;
}

function transform(json) {

    graph_data = {'nodes': [], 'links': [], 'labelAnchors': [],
        'labelAnchorLinks': []}

    for (var item in json['frames']) {
        for (var keyword in json['frames'][item]['keyword']) {
            node = {'label': keyword, 'group': 1,
                'score': json['frames'][item]['keyword'][keyword]}
            graph_data['nodes'].push(node)
            graph_data['labelAnchors'].push({'node': node})
            graph_data['labelAnchors'].push({'node': node})
        }
    }

    for (var item in json['frames']) {
        for (var frame_word in json['frames'][item]['frame']) {
            id_exists = false
            for (var node in graph_data['nodes']) {
                if (graph_data['nodes'][node]['label'] == frame_word) {
                    id_exists = true;
                    break;
                }
            }
            if (!id_exists) {
                node = {'label': frame_word, 'group': 2, 'score': 1}
                graph_data['nodes'].push(node)
                graph_data['labelAnchors'].push({'node': node})
                graph_data['labelAnchors'].push({'node': node})
            }
            for (var keyword in json['frames'][item]['keyword']) {
                var index = 0;
                var keyword_node_id = 0;
                for (var node in graph_data['nodes']) {
                    if (graph_data['nodes'][node]['label'] == keyword) {
                        keyword_node_id = index;
                        break;
                    }
                    index += 1
                }
                var index = 0;
                var frame_word_node_id = 0;
                for (var node in graph_data['nodes']) {
                    if (graph_data['nodes'][node]['label'] == frame_word) {
                        frame_word_node_id = index;
                        break;
                    }
                    index += 1
                }
                graph_data['links'].push({'source': frame_word_node_id,
                    'target': keyword_node_id,
                    'score': json['frames'][item]['frame'][frame_word]})
            }
        }
    }

    for(var i = 0; i < graph_data['nodes'].length; i++) {
        graph_data['labelAnchorLinks'].push({
            'source': i * 2,
            'target': i * 2 + 1,
            'score': 1
        });
    };

    return graph_data
}

function draw(graph_data) {
    /*
     * Adaptation of Mike Bostock’s Labeled Force Layout
     * https://bl.ocks.org/mbostock/950642
     */

    $('.graph').empty();

    var w = 870, h = 700;
    var color = ['', '#41ab5d', '#4292c6']

    var vis = d3.select('.graph').append('svg:svg').attr('width', w)
        .attr('height', h);

    var nodes = graph_data['nodes'];
    var labelAnchors = graph_data['labelAnchors'];
    var labelAnchorLinks = graph_data['labelAnchorLinks'];
    var links = graph_data['links'];

    var force = d3.layout.force().size([w, h]).nodes(nodes).links(links)
        .gravity(1).charge(-3000).linkStrength(5).linkDistance(function(d) {
            return Math.max(150 * (1 - d.score), 50);
    });

    force.start();

    var force2 = d3.layout.force().size([w, h]).nodes(labelAnchors)
        .links(labelAnchorLinks).gravity(0).linkDistance(0).linkStrength(5)
        .charge(-100);

    force2.start();

    var link = vis.selectAll('line.link').data(links).enter().append('svg:line')
        .attr('class', 'link').style('stroke-width', function(d) {
            return Math.min(Math.max(12 * d.score, 1), 10);
        });

    var node = vis.selectAll('g.node').data(force.nodes()).enter()
        .append('svg:g').attr('class', 'node');

    node.append('svg:circle')
        .attr('r', function(d) {
            return d.group == 1 ? Math.max(12.5 * d.score, 7) : 5;
        }).attr('fill', function(d) {
            return color[d.group];
        }).style('stroke', function(d) {
            return color[d.group];
        }).style('stroke-width', function(d) {
            return d.group == 1 ? Math.max(50 * d.score, 15) : 0;
        });

    node.call(force.drag);

    var anchorLink = vis.selectAll('line.anchorLink').data(labelAnchorLinks);

    var anchorNode = vis.selectAll('g.anchorNode').data(force2.nodes()).enter()
        .append('svg:g').attr('class', 'anchorNode');

    anchorNode.append('svg:circle').attr('r', 0);
    anchorNode.append('svg:text').text(function(d, i) {
        return i % 2 == 0 ? '' : d.node.label.split('/')[0].replace(/_/g, ' ');
    }).style('font-size', function(d) {
        return d.node.group == 1 ? String(Math.max(40 * d.node.score, 20)) +
        'px' : '18px';
    });

    var updateLink = function() {
        this.attr('x1', function(d) {
            return d.source.x;
        }).attr('y1', function(d) {
            return d.source.y;
        }).attr('x2', function(d) {
            return d.target.x;
        }).attr('y2', function(d) {
            return d.target.y;
        });
    }

    var updateNode = function() {
        this.attr('transform', function(d) {
            var radius = 20;
            d.x = Math.max(radius, Math.min(w - radius, d.x));
            d.y = Math.max(radius, Math.min(h - radius, d.y));
            return 'translate(' + d.x + ',' + d.y + ')';
        });
    }

    force.on('tick', function() {

        force2.start();

        node.call(updateNode);

        anchorNode.each(function(d, i) {
            if(i % 2 == 0) {
                d.x = d.node.x;
                d.y = d.node.y;
            } else {
                var b = this.childNodes[1].getBBox();
                var diffX = d.x - d.node.x;
                var diffY = d.y - d.node.y;
                var dist = Math.sqrt(diffX * diffX + diffY * diffY);
                var shiftX = b.width * (diffX - dist) / (dist * 2);
                shiftX = Math.max(-b.width, Math.min(0, shiftX));
                var shiftY = 5;
                this.childNodes[1].setAttribute('transform', 'translate(' +
                    shiftX + ',' + shiftY + ')');
            }
        });

        anchorNode.call(updateNode);
        link.call(updateLink);
        anchorLink.call(updateLink);
    });

}
