var app = {
	token : function() {
		return localStorage['token'];
	},

	username : function() {
		return localStorage['username'];
	},

	userId : function() {
		return localStorage['user_id'];
	},

	apiErr : function(resp) {
		if (resp.error.indexOf('authorized') !== -1) {
			app.logout();
		}
		app.alert('warning', 'Error', resp.error);
	},

	// Only to be used for fast visual hiding of elements, real validation is on the server side
	userRoles : function() {
		var l = localStorage['user_roles'];
		if (typeof l === 'undefined' || l === null) {
			return [];
		}
		return l.split(',');
	},

	alert : function(type, title, message) {
		$('#alert').html('<div class="alert alert-' + type + '" role="alert"><strong>' + title + '</strong> ' + message + '</div>');
		setTimeout(function() {
			$('#alert > div').slideUp();
		}, 2000);
	},

	_params : {},
	getParam : function(k) {
		var v = app._params[k];
		if (typeof v === 'undefined') {
			return null;
		}
		return v;
	},

	changeUser: function(values, username, token) {
		values["username"] = username
		values["token"] = token
		app.ajax('/user', { method: 'PUT', data : values }).done(function(resp) {
			var resp = app.handleResponse(resp);
			if (resp.status === 'OK') {
				app.showPage('users');
			}
		}, 'json');
	},

	showPage : function(input) {
		// Params?
		var qp = input.indexOf('?');
		var name = input;
		if (qp !== -1) {
			name = input.substr(0, qp);
			var paramStr = input.substr(qp + 1);
			var paramParts = paramStr.split('&');
			$(paramParts).each(function(i, part) {
				var kv = part.split('=');
				app._params[kv[0]] = decodeURIComponent(kv[1]);
			});
		}		

		// Unload
		if (typeof app.pages[currentPageName] !== 'undefined' && typeof app.pages[currentPageName]['unload'] === 'function') {
			app.pages[currentPageName]['unload']();
		}
		$('table.dataTable', app.pageInstance()).DataTable().destroy();
		$('form', app.pageInstance()).trigger('reset');

		// Current page
		var currentPage = $('.page-visible');
		var currentPageName = currentPage.attr('data-name');

		// New page
		if (currentPage != name) {
			history.pushState(null, null, '#!' + input);
		}
		currentPage.removeClass('page-visible');
		$('.page[data-name="' + name + '"]').addClass('page-visible');

		// 404?
		if (typeof app.pages[name] === 'undefined' && name !== '404') {
			this.showPage('404');
			return;
		}

		// Load
		if (typeof app.pages[name]['load'] === 'function') {
			app.pages[name]['load']();
		}

		// Hide elements that are not visible to your role
		app.updateRolesDom();
	},

	initTables : function(optsExtend) {
		var baseOpts = { 
			bPaginate : false,
			order: [[ 0, "asc" ]]
		};
		var opts = baseOpts;
		if (typeof optsExtend === 'object') {
			opts = $.extend(true, opts, optsExtend);
		}
		$('table:not(.nodatatable)', app.pageInstance()).DataTable().destroy(); $('table:not(.nodatatable)', app.pageInstance()).DataTable(opts);
	},

	updateRolesDom : function() {
		if (app.userRoles().length === 0) {
			return;
		}
		$('[data-roles]').each(function(i, elm) {
			var roles = $(elm).attr('data-roles').split(',');
			var hasAll = true;
			$(roles).each(function(i, role) {
				if (app.userRoles().indexOf(role) === -1) {
					hasAll = false;
				}
			});
			if (!hasAll) {
				$(this).hide();
			} else {
				if ($(elm).hasClass('page')) {
					if ($(elm).hasClass('page-visible')) {
						$(this).show();
					} else {
						$(this).hide();
					}
				}
			}
		});
	},

	initNav : function() {
		$('a[data-nav]').unbind('click');
		$('a[data-nav]').click(function(e) {
			app.showPage($(this).attr('data-nav'));
			// Hide nav on mobile
			if ($('button.navbar-toggle').is(':visible') && $('.navbar-collapse').hasClass('in')) {
				$('button.navbar-toggle').click();
			}
			e.preventDefault();
		});
	},

	shownNotifications : [],

	_serverInstanceId: '', // Used to identify server restarts (which can indicate updates and thus need a client-side refresh)

	pollWork : function() {
		var _pollWork = function() {
			if (typeof app.token() !== 'undefined' && app.token() !== null && app.token().length > 0) {
				app.ajax('/consensus/pending').done(function(resp) {
					var resp = app.handleResponse(resp);
					if (resp.status === 'OK') {
						// Server id
						if (app._serverInstanceId.length < 1) {
							// First connect
							app._serverInstanceId = resp.server_instance_id;
							console.log('Client connected to server ' + app._serverInstanceId);
						} else if (app._serverInstanceId !== resp.server_instance_id) {
							// Server ID changed
							if (!document.hasFocus()) {
								// No focus, refresh!
								document.location.reload(true);
							} else {
								// Show confirm
								if (confirm('The Indispenso server has restarted, please confirm to reload the page')) {
									document.location.reload(true);
								}
							}
						}

						// Notifications
						var keys = Object.keys(resp.work);
						for (var k in resp.work) {
							var work = resp.work[k];
							var notificationId = 'work_' + work.Id;
							if (typeof app.shownNotifications[notificationId] !== 'object') {
								var notification = app.showDesktopNotification('Pending Approval', '', 'pending');
								app.shownNotifications[notificationId] = notification;
							}
						}
					}
				});
			}
		};
		setInterval(function() {
			try {
				_pollWork();
			} catch (e) {
				console.error(e);
			}
		}, 3000);
		_pollWork();
	},

	run : function() {
		/** Top menu */
		app.initNav();

		/** Check for work notifications */
		this.pollWork();

		/** State change */
		window.onhashchange = function() {
			var h = document.location.hash.substr(2);
			if (h.length > 0) {
				app.showPage(h);
				return;
			}
		}

		/** Init route based of location */
		var h = document.location.hash.substr(2);
		if (h.length > 0) {
			app.showPage(h);
			return;
		}

		/** Login */
		if (typeof app.token() !== 'undefined' && app.token() !== null && app.token().length > 0) {
			app.showPage('home');
		} else {
			app.showPage('login');
		}
	},

	ajax : function(url, opts) {
		if (typeof opts === 'undefined' || opts === null) {
			opts = {};
		}
		if (typeof opts["headers"] === 'undefined') {
			opts["headers"] = {};
		}
		opts["headers"]["X-Auth-User"] = app.username();
		var token = app.token();
		if (typeof token === 'undefined' || token === null || token.length < 1) {
			console.error('Token not set, unable to perform ajax request');
			app.logout();
			return;
		}
		opts["headers"]["X-Auth-Session"] = token;
		opts["dataType"] = 'json';
		var x = $.ajax(url, opts);
		return x;
	},

	AuthMethods : function(type, authMethods ){
		var res = [];
		$.each(authMethods, function(key, value) {
			if( type&value ) {
				res.push(key);
			}
		});

		return res.join(", ");
	},

	handleResponse : function(resp) {
		if (resp['status'] !== 'OK') {
			app.apiErr(resp);
		}
		return resp;
	},

	pageInstance : function() {
		return $('.page-visible');
	},

	bindData : function(k, v) {
		$('[data-bind="' + k + '"]', app.pageInstance()).html(v);
	},
	/**
	 *
	 * @param id
	 * @param lines array of lines to be bounded
     */
	bindBashDataLines : function( id,lines ) {
		app.bindData(id, ansi_up.ansi_to_html(lines.join("\n")) )
	},

	logout : function() {
		delete localStorage['token'];
		delete localStorage['username'];
		delete localStorage['user_id'];
		delete localStorage['user_roles'];
		app.showPage('login');
	},

	_openNotification : false,

	showDesktopNotification : function(title, msg, targetPage) {
		if (!Notification) {
			return
		}
		var notification = new Notification(title, {
	      body: msg,
	    });
	    app._openNotification = true;
	    notification.onclick = function () {
	     	window.focus();
	     	app._openNotification = false;
	     	if (targetPage !== 'undefined' && targetPage !== null) {
	      		app.showPage(targetPage);
	    	}
	    };

	    return notification;
	},

	requestDesktopNotification : function() {
		if (!Notification) {
			return
		}
		if (Notification.permission !== 'granted') {
		    Notification.requestPermission();
		}
	},

	pages : {
		home : {
			load : function() {
				app.ajax('/clients').done(function(resp) {
					var resp = app.handleResponse(resp);
					if (resp.status === 'OK') {
						app.bindData('number-of-clients', resp.clients.length);
					}
				});
				app.ajax('/consensus/pending').done(function(resp) {
					var resp = app.handleResponse(resp);
					if (resp.status === 'OK') {
						app.bindData('number-of-pending', Object.keys(resp.requests).length);
						app.bindData('number-of-work', Object.keys(resp.work).length);
					}
				});

				// Ask notification permissions
				app.requestDesktopNotification();
			}
		},

		profile : {
			load : function() {
				$('form#change-password').submit(function() {
					app.ajax('/user/password', { method: 'PUT', data : $(this).serialize() }).done(function(resp) {
						var resp = app.handleResponse(resp);
						if (resp.status === 'OK') {
							app.logout();
						}
					}, 'json');
					return false;
				});
			},
			unload : function() {
				$('form#change-password').unbind('submit');
			}
		},

		clients : {
			load : function() {
				app.ajax('/clients').done(function(resp) {
					var resp = app.handleResponse(resp);
					var rows = [];
					var listTags = [];
					$(resp.clients).each(function(i, client) {
						var tags = [];
						$(client.Tags).each(function(j, tag) {
							tags.push('<span class="label label-primary">' + tag + '</span>');
							if (listTags.indexOf(tag) === -1) {
								listTags.push(tag);
							}
						});
						var lastTime = client.LastPing.substr(0, client.LastPing.indexOf('.')).replace('T', ' ');
						rows.push('<tr class="client"><td>' + client.ClientId + '</td><td>' + tags.join("\n") + '</td><td>' + lastTime + '</td></tr>');
					});
					app.bindData('clients', rows.join("\n"));
					

					// List of tags
					var listTagsHtml = [];
					$(listTags).each(function(i, tag) {
						listTagsHtml.push('<li><span class="label label-primary filter-tag clickable" data-included="1" data-tag="' + tag + '">' + tag + '</span></li>');
					});
					app.bindData('tags', listTagsHtml.join("\n"));

					app.initTables();

					// Filter based on tags
					$('span.filter-tag', app.pageInstance()).click(function() {
						var included = $(this).attr('data-included') === '1';
						if (included) {
							$(this).removeClass('label-primary').addClass('label-default').attr('data-included', '0');
						} else {
							$(this).removeClass('label-default').addClass('label-primary').attr('data-included', '1');
						}

						// On tags
						var onTags = [];
						$('span.filter-tag[data-included="1"]').each(function(i, on) {
							onTags.push($(on).attr('data-tag'));
						});

						// Update list
						$('tr.client').each(function(i, tr) {
							var found = false;
							var trHtml = $(tr).html();
							$(onTags).each(function(j, tag) {
								if (trHtml.indexOf(tag) !== -1) {
									found = true;
									return false;
								}
							});
							if (!found) {
								$(tr).hide();
							} else {
								$(tr).show();
							}
						});

						return false;
					});

					// Double click on filter tag only turns on that specific one
					$('.filter-tag').dblclick(function() { 
						var tag = $(this).attr('data-tag'); 
						$('.filter-tag:not([data-tag="' + tag + '"])').click(); 
						return false; 
					});
				});
			}
		},

		'404' : {
			load : function() {
			}
		},

		pending : {
			load : function() {
				app.ajax('/templates').done(function(resp) {
					var resp = app.handleResponse(resp);
					var templates = resp.templates;

					app.ajax('/users/names').done(function(resp) {
						var resp = app.handleResponse(resp);
						var userNames = resp.users;
						var userMap = {};
						$(userNames).each(function(i, user) {
							userMap[user.Id] = user;
						});

						app.ajax('/consensus/pending').done(function(resp) {
							var resp = app.handleResponse(resp);
							if (resp.status === 'OK') {
								var workKeys = Object.keys(resp.work);
								var workHtml = [];
								$(workKeys).each(function(i, workKey) {
									var work = resp.work[workKey];
									var template = templates[work.TemplateId];
									var user = userMap[work.RequestUserId];
									if (typeof user === 'undefined') {
										user = {
											Id : '',
											Username : ''
										}
									}

									var lines = [];
									lines.push('<tr>');
									lines.push('<td><a href="#" data-nav="request-execution?id=' + template.Id + '">' + template.Title + '</a></td>');
									lines.push('<td>' + user.Username + '</td>');
									lines.push('<td>' + work.ClientIds.join(', ') + '</td>');
									lines.push('<td>' + work.Reason + '</td>');
									lines.push('<td><div class="btn-group btn-group-xs pull-right"><span class="btn btn-success approve-request" data-roles="approver" data-id="' + work.Id + '">Approve</span> <span class="btn btn-default cancel-request" data-id="' + work.Id + '">Cancel</span></div></td>');
									lines.push('</tr>');
									workHtml.push(lines.join(''));
								});
								app.bindData('work', workHtml.join("\n"));
								$('.approve-request', app.pageInstance()).click(function() {
									var id = $(this).attr('data-id');
									app.ajax('/consensus/approve', { method: 'POST', data : { id : id } }).done(function(resp) {
										var resp = app.handleResponse(resp);
										if (resp.status === 'OK') {
											// Cancel notification?
											try {
												var notificationId = 'work_' + id;
												if (typeof app.shownNotifications[notificationId] === 'object') {
													app.shownNotifications[notificationId].close();
												}
											} catch (e) {
												console.error(e);
											}
											app.showPage('pending');
										}
									});
								});

								var workHtml = [];
								var requestKeys = Object.keys(resp.requests);
								$(requestKeys).each(function(i, requestKey) {
									var request = resp.requests[requestKey];
									var template = templates[request.TemplateId];
									var user = userMap[request.RequestUserId];
									if (typeof user === 'undefined') {
										user = {
											Id : '',
											Username : ''
										}
									}

									var lines = [];
									lines.push('<tr>');
									lines.push('<td><a href="#" data-nav="request-execution?id=' + template.Id + '">' + template.Title + '</a></td>');
									lines.push('<td>' + user.Username + '</td>');
									lines.push('<td>' + request.ClientIds.join(', ') + '</td>');
									lines.push('<td>' + request.Reason + '</td>');
									lines.push('<td>');
									if (user.Id === app.userId() || app.userRoles().indexOf('admin') !== -1) {
										lines.push('<div class="btn-group btn-group-xs pull-right"><span class="btn btn-default cancel-request" data-id="' + request.Id + '">Cancel</span></div>');
									}
									lines.push('</td>');
									lines.push('</tr>');
									workHtml.push(lines.join(''));
								});
								app.bindData('pending', workHtml.join("\n"));

								app.initTables();
								app.initNav();
								
								$('.cancel-request', app.pageInstance()).click(function() {
									var id = $(this).attr('data-id');
									app.ajax('/consensus/request?id=' + id, { method: 'DELETE' }).done(function(resp) {
										var resp = app.handleResponse(resp);
										if (resp.status === 'OK') {
											app.showPage('pending');
										}
									});
								});
							}
						});
					});
				});
			}
		},

		users : {
			load : function() {
				app.ajax('/users').done(function(resp) {
					var resp = app.handleResponse(resp);
					var html = [];
					for (var k in resp.users) {
						if (!resp.users.hasOwnProperty(k)) {
							continue;
						}
						var obj = resp.users[k];
						var lines = [];
						lines.push('<tr class="user-row" data-username="'+obj.Username+'">');
						lines.push('<td>' + obj.Username + '</td>');
						lines.push('<td>' + Object.keys(obj.Roles).join(', ') + '</td>');
						lines.push('<td>' + app.AuthMethods( obj.AuthType,resp.authTypes ) + '</td>');
						lines.push('<td><input type="checkbox" class="enable-user" '+ (obj.Enabled == true ? 'checked="checked"' : '')+' /></td>');
						lines.push('<td><div class="btn-group btn-group-xs pull-right"><span class="btn btn-default delete-user"><i class="fa fa-trash-o" title="Delete"></i></span></div></td>');
						lines.push('</tr>');
						html.push(lines.join("\n"));
					}
					app.bindData('users', html.join("\n"));
					app.initTables();
					

					$('.delete-user').click(function() {
						var username = $(this).closest("tr").attr('data-username');
						if (!confirm('Are you sure you want to delete "' + username + '"?')) {
							return;
						}

						// Admin totp challenge
						var adminTotp = prompt("Please enter your own two factor token to authorize the deletion of a user", "");

						app.ajax('/user?username=' + username + '&admin_totp=' + adminTotp, { method: 'DELETE' }).done(function(resp) {
							var resp = app.handleResponse(resp);
							if (resp.status === 'OK') {
								app.showPage('users');
							}
						});
					});

					$('.enable-user').change(function(e) {
						e.preventDefault();
						var username = $(this).closest("tr").attr('data-username');
						var enableVal = $(this).is(':checked');
						this.checked = !enableVal;

						if (!confirm('Are you sure you want to '+( enableVal ? "enable" : "disable" )+' "' + username + '"?')) {
							return;
						}

						// Admin totp challenge
						var adminTotp = prompt("Please enter your own two factor token to authorize the change of a user", "");
						if(adminTotp == null || adminTotp.length < 2) {
							app.alert("danger","Invalid token", "Token is too short");
							return;
						}
						app.changeUser({enable:enableVal},username, adminTotp);
					});
				});
			},
			unload : function() {
				$('.delete-user').unbind('click');
				$('.enable-user').unbind('click');
			}
		},

		'create-user' : {
			load : function() {
				$('.select2', app.pageInstance()).select2();
				$('form#create-user').submit(function() {
					var data = $(this).serializeArray();
					var d = {};
					for (var k in data) {
						var v = data[k];
						d[v['name']] = v['value'];
					}
					try { d['roles'] = $('#roles', app.pageInstance()).val().join(','); } catch (e) {}

					// Admin totp challenge
					var adminTotp = prompt("Please enter your own two factor token to authorize the creation of a new user", "");
					d['admin_totp'] = adminTotp;

					// Post data
					app.ajax('/user', { method: 'POST', data : d }).done(function(resp) {
						var resp = app.handleResponse(resp);
						if (resp.status === 'OK') {
							app.showPage('users');
						}
					}, 'json');
					return false;
				});
			},
			unload : function() {
				$('form#create-user').unbind('submit');
			}
		},

		'http-checks' : {
			load : function() {
				// Templates for mapping
				app.ajax('/templates').done(function(resp) {
					var resp = app.handleResponse(resp);
					var templates = resp.templates;

					// Checks
					app.ajax('/http-checks').done(function(resp) {
						var resp = app.handleResponse(resp);
						var checks = resp.checks;
						var trs = [];
						for (var k in checks) {
							var check = checks[k];
							var template = {
								Title: '-'
							};
							if (typeof templates[check.TemplateId] !== 'undefined') {
								template = templates[check.TemplateId];
							}
							var uri = document.location.origin + '/http-check/' + check.Id + '?token=' + check.SecureToken;
							var lines = [];
							lines.push('<tr>');
							lines.push('<td>' + template.Title + '</td>');
							lines.push('<td>' + check.ClientIds.join(', ') + '</td>');
							lines.push('<td><div class="btn-group btn-group-xs pull-right"><a class="btn btn-default" href="' + uri + '" target="_blank" data-roles="requester" href="#">Execute</a> <span class="btn btn-default delete-http-check" data-roles="admin" data-id="' + check.Id + '"><i class="fa fa-trash-o" title="Delete"></i></span></div></td>');
							lines.push('</tr>');
							trs.push(lines.join(''));
								
						}
						app.bindData('checks', trs.join("\n"));

						app.initNav();
						app.updateRolesDom();
						$('.delete-http-check').click(function() {
							var id = $(this).attr('data-id');
							if (!confirm('Are you sure you want to delete this http check?')) {
								return;
							}
							app.ajax('/http-check?id=' + id, { method: 'DELETE' }).done(function(resp) {
								var resp = app.handleResponse(resp);
								if (resp.status === 'OK') {
									app.showPage('http-checks');
								}
							});
						});
					});
				});
			}
		},

		templates : {
			load : function() {
				app.ajax('/templates').done(function(resp) {
					var resp = app.handleResponse(resp);
					var templatesHtml = [];
					for (var k in resp.templates) {
						if (!resp.templates.hasOwnProperty(k)) {
							continue;
						}
						var template = resp.templates[k];
						var lines = [];
						lines.push('<tr>');
						lines.push('<td>' + template.Title + '</td>');
						var tags = [];
						$(template.Acl.IncludedTags).each(function(i, tag) {
							tags.push('<span class="label label-primary">' + tag + '</span>');
						});
						$(template.Acl.ExcludedTags).each(function(i, tag) {
							tags.push('<span class="label label-danger">' + tag + '</span>');
						});
						if (tags.length === 0) {
							tags.push('<span class="label label-success">ANY</span>');
						}
						lines.push('<td>' + tags.join(" ") + '</td>');
						lines.push('<td><div class="btn-group btn-group-xs pull-right"><a class="btn btn-default" data-nav="request-execution?id=' + template.Id + '" data-roles="requester" href="#">Execute</a> <span class="btn btn-default delete-template" data-roles="admin" data-id="' + template.Id + '"><i class="fa fa-trash-o" title="Delete"></i></span></div></td>');
						lines.push('</tr>');
						templatesHtml.push(lines.join("\n"));
					}
					app.bindData('templates', templatesHtml.join("\n"));

					app.initTables();
					
					app.initNav();
					app.updateRolesDom();
					$('.delete-template').click(function() {
						var id = $(this).attr('data-id');
						if (!confirm('Are you sure you want to delete this template?')) {
							return;
						}
						app.ajax('/template?id=' + id, { method: 'DELETE' }).done(function(resp) {
							var resp = app.handleResponse(resp);
							if (resp.status === 'OK') {
								app.showPage('templates');
							}
						});
					});
				});
			}
		},

		'request-execution' : {
			load : function() {
				$('.request-execution', app.pageInstance()).show();
				$('.select-clients', app.pageInstance()).hide();

				// Clear old reason
				$('input[name="reason"]', app.pageInstance()).val('');

				var id = app.getParam('id');
				if (id === null || id.length < 1) {
					console.log('No id');
					return app.showPage('templates');
				}
				app.ajax('/templates').done(function(resp) {
					var resp = app.handleResponse(resp);
					var template = resp.templates[id];
					if (typeof template === 'undefined' || template === null) {
						console.log('Template not found');
						return app.showPage('templates');
					}

					// Title
					app.bindData('template-title', template.Title);
					app.bindData('template-description', template.Description);
					app.bindData('template-command', template.Command);
					app.bindData('template-minAuth', template.Acl.MinAuth);
					if (template.Timeout != '0') {
						app.bindData('template-timeout', template.Timeout);
					} else {
						app.bindData('template-timeout', '<i>None</i>');
					}
					var strategyName = '-';
					if (template.ExecutionStrategy !== null) {
						switch (template.ExecutionStrategy.Strategy) {
							case 0:
								strategyName = 'Simple';
							break;
							case 1:
								strategyName = 'Test one';
							break;
							case 2:
								strategyName = 'Rolling';
							break;
							case 3:
								strategyName = 'Exponential rolling';
							break;
							default:
								strategyName = '-';
							break;
						}
					}
					app.bindData('template-execution-strategy', strategyName);

					// Get eligible clients
					app.ajax('/clients?filter_tags_include=' + encodeURIComponent(template.Acl.IncludedTags.join(',')) + '&filter_tags_exclude=' + encodeURIComponent(template.Acl.ExcludedTags.join(','))).done(function(resp) {
						var resp = app.handleResponse(resp);
						var rows = [];
						$(resp.clients).each(function(i, client) {
							var tags = [];
							$(client.Tags).each(function(j, tag) {
								tags.push('<span class="label label-primary">' + tag + '</span>');
							});
							rows.push('<tr class="client"><td><input type="checkbox" class="select-client" data-id="' + client.ClientId + '" value="1"></td><td>' + client.ClientId + '</td><td>' + tags.join("\n") + '</td><td>' + client.LastPing + '</td></tr>');
						});
						app.bindData('clients', rows.join("\n"));

						app.initTables();
						
						// Select helpers
						$('.select-client-helper', app.pageInstance()).unbind('click');
						$('.select-client-helper', app.pageInstance()).click(function() {
							var selection = $(this).attr('data-selection');
							var trs = $('tbody[data-bind="clients"] > tr', app.pageInstance());
							var hostCount = trs.length;

							var getRandomHost = function() {
								return $(trs[Math.floor(Math.random()*hostCount)]);
							};

							var targetSelectCount;
							if (selection === '1-random') {
								// Random one
								targetSelectCount = 1;
							} else if (selection.indexOf('percent') !== -1) {
								// Random percentage
								var split = selection.split('-');
								var percentage = parseInt(split[0], 10) / 100; // range 0 - 1
								targetSelectCount = Math.max(1, Math.round(hostCount * percentage));
							}

							var maxIter = hostCount * 2;
							var selectedCount = 0;
							for (i = 0; i < maxIter; i++) {
								var host = getRandomHost();
								var cb = getRandomHost().find('.select-client');
								var isChecked = cb.is(':checked');
								if (isChecked) {
									// Already selected, continue search
									continue;
								}
								cb.prop("checked", true);
								selectedCount++;
								if (selectedCount >= targetSelectCount) {
									break;
								}
							}

							return false;
						});

						// Make button active
						$('.request-execution > .btn', app.pageInstance()).unbind('click');
						$('.request-execution > .btn', app.pageInstance()).click(function() {
							$('.request-execution', app.pageInstance()).hide();
							$('.select-clients', app.pageInstance()).show();
						});

						// Toggle all
						$('.toggle-clients', app.pageInstance()).unbind('click');
						$('.toggle-clients', app.pageInstance()).click(function() {
							var on = $(this).attr('data-state') === '1';
							if (on) {
								// Turn off
								$('.select-client', app.pageInstance()).prop("checked", false);
								$(this).attr('data-state', '0');
							} else {
								// Turn ON
								$('.select-client', app.pageInstance()).prop("checked", true);
								$(this).attr('data-state', '1');
							}
						});

						// Get client ids
						var getClientIds = function() {
							var clientIds = [];
							$('.select-client:checked').each(function(i, cb) {
								clientIds.push($(cb).attr('data-id'));
							});
							return clientIds;
						}

						// Execute
						$('.do-request', app.pageInstance()).unbind('click');
						$('.do-request', app.pageInstance()).click(function() {
							// Reason
							var reason = $('input[name="reason"]', app.pageInstance()).val();

							// List clients
							var clientIds = getClientIds();
							if (clientIds.length < 1) {
								app.alert('warning', 'No clients', 'You need to select at least one target client');
								return;
							}

							// Totp challenge
							var totp = prompt("Please enter your two factor token to authorize the request for execution of this command", "");

							// Request
							app.ajax('/consensus/request', { method: 'POST', data : { template : template.Id, clients : clientIds.join(','), reason : reason, totp : totp } }).done(function(resp) {
								var resp = app.handleResponse(resp);
								if (resp.status === 'OK') {
									if (template.Acl.MinAuth > 1) {
										// Other people have to sign, go to pending page
										app.showPage('pending');
									} else {
										// Will start right now, go to history
										app.showPage('history');
									}
								}
							});

							return false;
						});

						// Create HTTP Check
						$('.create-http-check', app.pageInstance()).unbind('click');
						$('.create-http-check', app.pageInstance()).click(function() {
							// List clients
							var clientIds = getClientIds();
							if (clientIds.length < 1) {
								app.alert('warning', 'No clients', 'You need to select at least one target client');
								return;
							}

							// Are you sure you want an min auth larger than 1, this will cause the http check to start a voting round
							if (template.Acl.MinAuth > 1) {
								if (!confirm('Are you sure you want to create an http check with "Minimum authorizations" larger than one (1)? This will let the http check trigger a consensus approval round.')) {
									return;
								}
							}

							// Totp challenge
							var totp = prompt("Please enter your two factor token to create a new http check", "");

							// Request
							app.ajax('/http-check', { method: 'POST', data : { template : template.Id, clients : clientIds.join(','), totp : totp } }).done(function(resp) {
								var resp = app.handleResponse(resp);
								if (resp.status === 'OK') {
									app.showPage('http-checks');
								}
							});

							return false;
						});
					});
				});
			}
		},

		'create-template' : {
			load : function() {
				app.ajax('/tags').done(function(resp) {
					var resp = app.handleResponse(resp);
					var tagOptions = [];
					$(resp.tags).each(function(i, tag) {
						tagOptions.push('<option value="' + tag + '">' + tag + '</option>');
					});
					app.bindData('tags', tagOptions.join("\n"));
					$('.select2', app.pageInstance()).select2();
				});

				$('form#create-template').submit(function() {
					var data = $(this).serializeArray();
					var d = {};
					for (var k in data) {
						var v = data[k];
						d[v['name']] = v['value'];
					}
					try { d['includedTags'] = $('#includedTags', app.pageInstance()).val().join(','); } catch (e) {}
					try { d['excludedTags'] = $('#excludedTags', app.pageInstance()).val().join(','); } catch (e) {}
					app.ajax('/template', { method: 'POST', data : d }).done(function(resp) {
						var resp = app.handleResponse(resp);
						if (resp.status === 'OK') {
							// Validation rule to create?
							if (typeof d['standardOutputMustContain'] !== 'undefined' && d['standardOutputMustContain'].length > 0) {
								app.ajax('/template/' + resp.template.Id + '/validation', { method : 'POST', data : { text : d['standardOutputMustContain'], fatal: '1', must_contain: '1' } }).done(function(resp) { });
							}

							app.showPage('templates');
						}
					}, 'json');
					return false;
				});
			},
			unload : function() {
				$('form#create-template').unbind('submit');
			}
		},

		logs : {
			load : function() {
				var id = app.getParam('id');
				var client = app.getParam('client');
				app.ajax('/client/' + client + '/cmd/' + id + '/logs').done(function(resp) { 
					var resp = app.handleResponse(resp);
					if (resp.status !== 'OK') {
						app.showPage('history');
						return;
					}

					var lis = [];
					$(resp.log_output).each(function(i, line) {
						lis.push(line);
					});
					app.bindBashDataLines('out', lis);

					var lis = [];
					$(resp.log_error).each(function(i, line) {
						lis.push(line);
					});
					app.bindBashDataLines('err', lis);
				});
			}
		},

		history : {
			load : function() {
				app.initTables({
								   order: [[ 0, "desc" ]],
								   processing: true,
								   serverSide: true,
								   bPaginate: true,
								   ajax: {
									   url: "/dispatched",
									   type: "POST"
								   },
								   "drawCallback": function( settings ) {
									   app.initNav(); // Bind logs button
								   },
					               columns: [
									   { "data": "created" },
									   { "data": "template" },
									   { "data": "user" },
									   { "data": "client" },
									   { "data": "state" },
									   {
										   "data": "link",
										   render : function( data, type, row, meta ){
											   return "<div class='btn-group btn-group-xs pull-right'><a class='btn btn-default' data-nav='"+data+"' href='#'><i class='fa fa-list-alt' title='Logs'></i></a></div>"
										   }
									   }
								   ]
							   });
			}
		},

		'setup-2fa' : {
			load : function() {
				app.ajax('/user/2fa').done(function(resp) {
					var resp = app.handleResponse(resp);
					if (resp.status === 'OK') {
						var img = $('<img>');
						img.attr('src', 'data:image/png;base64,' + resp.Png);
						$('#qr', app.pageInstance()).html(img);

						// Form submit
						$('#validate-2fa', app.pageInstance()).unbind('submit');
						$('#validate-2fa', app.pageInstance()).submit(function() {
							var d = $(this).serialize();
							app.ajax('/user/2fa', {method : 'PUT', data : d }).done(function(resp) { 
								var resp = app.handleResponse(resp);
								if (resp.status === 'OK' && resp.enabled === true) {
									app.alert('info', 'Two Factor', 'Setup completed, next time you will be asked your two factor token on login.');
									app.showPage('home');
								}
							});
							return false;
						});
					} else {
						app.showPage('home');
					}
				});
			}
		},

		logout : {
			load : function() {
				app.logout();
			}
		},

		login : {
			load : function() {
				$('.navbar-nav').hide();
				$('form#login').unbind('submit');
				$('form#login').submit(function() {
					$.post('/auth', $(this).serialize(), function(resp) {
						if (resp.status === 'OK') {
							localStorage['token'] = resp.session_token;
							localStorage['user_id'] = resp.user_id;
							localStorage['username'] = $('form#login input[name="username"]').val();
							localStorage['user_roles'] = resp.user_roles.join(',');
							app.alert('info', 'Login successful', 'Welcome back ' + localStorage['username']);
							$('.navbar-nav').show();
							app.showPage('home');

							// Setup 2fa
							if (resp.two_factor_enabled === false) {
								app.showPage('setup-2fa');
							}
						} else {
							app.apiErr(resp);
						}
					}, 'json');
					return false;
				});
			},
			unload : function() {
				$('.navbar-nav').show();
				$('form#login').unbind('submit');
			}
		}
	}
};
$(document).ready(function() {
	app.run();
});
