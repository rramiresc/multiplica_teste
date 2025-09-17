/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

document.addEventListener('DOMContentLoaded', function() {
    console.log("DEBUG JS: DOM totalmente carregado e pronto para a ação.");

    const state = {
        currentPage: {},
        currentFilters: {},
        user: { accessLevel: 'none', nome: null, cpf: null, email: null },
        visibility: {}
    };

    const AVALIACAO_QUESTIONS_MAP = {
        'q1_1': '1.1 - Promove um ambiente virtual seguro, respeitoso e acolhedor...',
        'q1_2': '1.2 - Conduz a formação em ambiente adequado...',
        'q1_3': '1.3 - Estimula os demais participantes a seguirem as regras de etiqueta...',
        'q2_1': '2.1 - Inicia a formação no horário determinado.',
        '2.2': '2.2 - Gerencia o tempo assegurando a realização das atividades...',
        'q2_3': '2.3 - Encerra a formação no horário estipulado.',
        'q3_1': '3.1 - Utiliza estratégias e técnicas que favoreçam a participação...',
        'q3_2': '3.2 - Estimulados pelo formador, os participantes contribuem...',
        'q3_3': '3.3 - Gerencia o tempo de forma eficiente...',
        'q4_1': '4.1 - Utiliza vocabulário acessível e de fácil compreensão...',
        '4.2': '4.2 - Faz perguntas disparadoras, coerentes com o conteúdo...',
        '4.3': '4.3 - As discussões se mantêm produtivas e alinhadas...',
        'q5_1': '5.1 - Demonstra domínio do conteúdo proposto na Pauta...',
        '5.2': '5.2 - Promove e estimula exemplos práticos...',
        '5.3': '5.3 - Assegura que a formação aconteça numa sequência lógica...'
    };

    const MODAL_TEMPLATES = {
        'presenca': (r) => `<h3>Editar Registro de Presença</h3><form id="editForm" data-table="presenca"><input type="hidden" name="id" value="${r.id}"><p><strong>Participante:</strong> ${r.nome_participante}</p><p><strong>Data:</strong> ${new Date(r.data_formacao).toLocaleDateString('pt-BR')}</p><label>Presença:</label><div class="radio-group"><label><input type="radio" name="presenca" value="SIM" ${r.presenca === 'SIM' ? 'checked' : ''}> SIM</label><label><input type="radio" name="presenca" value="NÃO" ${r.presenca === 'NÃO' ? 'checked' : ''}> NÃO</label></div><label>Câmera:</label><div class="radio-group"><label><input type="radio" name="camera" value="SIM" ${r.camera === 'SIM' ? 'checked' : ''}> SIM</label><label><input type="radio" name="camera" value="NÃO" ${r.camera === 'NÃO' ? 'checked' : ''}> NÃO</label></div><div class="button-group"><button type="submit" class="modal-save-button">Salvar</button><button type="button" class="modal-close-button close-button">Cancelar</button></div></form>`,
        'acompanhamento': (r) => `<h3>Editar Registro de Acompanhamento</h3><form id="editForm" data-table="acompanhamento"><input type="hidden" name="id" value="${r.id}"><p><strong>Turma:</strong> ${r.turma}</p><p><strong>Data:</strong> ${new Date(r.data_encontro).toLocaleDateString('pt-BR')}</p><label>Encontro Realizado:</label><div class="radio-group"><label><input type="radio" name="encontro_realizado" value="Sim" ${r.encontro_realizado === 'Sim' ? 'checked' : ''}> Sim</label><label><input type="radio" name="encontro_realizado" value="Não" ${r.encontro_realizado === 'Não' ? 'checked' : ''}> Não</label></div><div id="modal-encontro-realizado-sim" class="form-section" style="${r.encontro_realizado === 'Sim' ? 'display:block;' : 'display:none;'}"><label for="real_participantes">Participantes reais:</label><input type="number" name="real_participantes" value="${r.real_participantes || 0}"><label for="camera_aberta_participantes">Câmera aberta:</label><input type="number" name="camera_aberta_participantes" value="${r.camera_aberta_participantes || 0}"></div><div id="modal-encontro-realizado-nao" class="form-section" style="${r.encontro_realizado === 'Não' ? 'display:block;' : 'display:none;'}"><label for="motivo_nao_ocorrencia">Motivo da não ocorrência:</label><textarea name="motivo_nao_ocorrencia">${r.motivo_nao_ocorrencia || ''}</textarea></div><label for="observacao">Observação:</label><textarea name="observacao">${r.observacao || ''}</textarea><div class="button-group"><button type="submit" class="modal-save-button">Salvar</button><button type="button" class="modal-close-button close-button">Cancelar</button></div></form>`,
        'avaliacao': (r) => `<h3>Editar Registro de Avaliação</h3><form id="editForm" data-table="avaliacao"><input type="hidden" name="id" value="${r.id}"><p><strong>Observado:</strong> ${r.observado}</p><p><strong>Data:</strong> ${new Date(r.data_acompanhamento).toLocaleDateString('pt-BR')}</p><label for="nota_final">Nota Final:</label><input type="number" name="nota_final" value="${r.nota_final || 0}" step="0.01"><label for="feedback_estruturado">Feedback Estruturado:</label><textarea name="feedback_estruturado" rows="4">${r.feedback_estruturado || ''}</textarea><div class="button-group"><button type="submit" class="modal-save-button">Salvar</button><button type="button" class="modal-close-button close-button">Cancelar</button></div></form>`,
        'demandas': (r) => `<h3>Editar Registro de Demanda</h3><form id="editForm" data-table="demandas"><input type="hidden" name="id" value="${r.id}"><p><strong>PEC:</strong> ${r.pec}</p><p><strong>Semana:</strong> ${r.semana}</p><p><strong>Diretoria:</strong> ${r.diretoria_de_ensino}</p><label for="formacoes_realizadas">Formações realizadas:</label><input type="number" name="formacoes_realizadas" value="${r.formacoes_realizadas || 0}"><div class="button-group"><button type="submit" class="modal-save-button">Salvar</button><button type="button" class="modal-close-button close-button">Cancelar</button></div></form>`,
        'ateste': (r) => `<h3>Editar Registro de Ateste</h3><form id="editForm" data-table="ateste"><input type="hidden" name="id" value="${r.id}"><p><strong>Nome:</strong> ${r.nome_quem_preencheu}</p><p><strong>Data:</strong> ${new Date(r.data_formacao).toLocaleDateString('pt-BR')}</p><label for="valor_formacao">Valor da Formação:</label><input type="number" name="valor_formacao" value="${r.valor_formacao || 0}" step="0.01"><div class="button-group"><button type="submit" class="modal-save-button">Salvar</button><button type="button" class="modal-close-button close-button">Cancelar</button></div></form>`,
        'ocorrencias': (r) => `<h3>Editar Registro de Ocorrência</h3><form id="editForm" data-table="ocorrencias"><input type="hidden" name="id" value="${r.id}"><p><strong>Relator:</strong> ${r.nome}</p><p><strong>Data/Hora:</strong> ${new Date(r.data_horario).toLocaleDateString()} ${new Date(r.data_horario).toLocaleTimeString()}</p><label for="ocorrencia_ainda_ocorre">Ainda ocorre?</label><div class="radio-group"><label><input type="radio" name="ocorrencia_ainda_ocorre" value="Sim" ${r.ocorrencia_ainda_ocorre === 'Sim' ? 'checked' : ''}> Sim</label><label><input type="radio" name="ocorrencia_ainda_ocorre" value="Não" ${r.ocorrencia_ainda_ocorre === 'Não' ? 'checked' : ''}> Não</label></div><div class="button-group"><button type="submit" class="modal-save-button">Salvar</button><button type="button" class="modal-close-button close-button">Cancelar</button></div></form>`,
        'visitas': (r) => `<h3>Editar Registro de Visitação</h3><form id="editForm" data-table="visitas"><input type="hidden" name="id" value="${r.id}"><p><strong>Responsável:</strong> ${r.responsavel_visitacao}</p><p><strong>Data:</strong> ${new Date(r.data_formacao).toLocaleDateString('pt-BR')}</p><label for="encontro_aconteceu">Encontro Aconteceu?:</label><div class="radio-group"><label><input type="radio" name="encontro_aconteceu" value="Sim" ${r.encontro_aconteceu === 'Sim' ? 'checked' : ''}> Sim</label><label><input type="radio" name="encontro_aconteceu" value="Não" ${r.encontro_aconteceu === 'Não' ? 'checked' : ''}> Não</label></div><div class="button-group"><button type="submit" class="modal-save-button">Salvar</button><button type="button" class="modal-close-button close-button">Cancelar</button></div></form>`,
        'usuarios': (r) => `<h3>Editar Usuário</h3><form id="editForm" data-table="usuarios"><input type="hidden" name="cpf" value="${r.cpf}"><p><strong>CPF:</strong> ${r.cpf}</p><label for="access_level">Nível de Acesso:</label><select id="access_level" name="access_level" required><option value="no_access" ${r.access_level === 'no_access' ? 'selected' : ''}>Sem Acesso</option><option value="basic_access" ${r.access_level === 'basic_access' ? 'selected' : ''}>Basic</option><option value="power_user" ${r.access_level === 'power_user' ? 'selected' : ''}>Power User</option><option value="super_admin" ${r.access_level === 'super_admin' ? 'selected' : ''}>Admin</option></select><div class="button-group"><button type="submit" class="modal-save-button">Salvar</button><button type="button" class="modal-close-button close-button">Cancelar</button></div></form>`
    };

    const API = {
        async get(url) {
            try {
                const response = await fetch(url);
                if (!response.ok) {
                    const errorText = await response.text();
                    const isHtml = errorText.startsWith('<!DOCTYPE');
                    if (isHtml) {
                        window.location.href = '/login'; // Redireciona se a resposta for a página de login
                        throw new Error('Redirecionando para login.');
                    }
                    const errorData = JSON.parse(errorText);
                    throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
                }
                return await response.json();
            } catch (error) {
                console.error(`ERRO API: Falha ao buscar dados de ${url}:`, error);
                throw error;
            }
        },
        async post(url, data) {
            try {
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                if (!response.ok) {
                    const errorMessage = result.message || `HTTP error! status: ${response.status}`;
                    alert(errorMessage);
                    throw new Error(errorMessage);
                }
                return result;
            } catch (error) {
                console.error(`ERRO API: Erro ao enviar dados para ${url}:`, error);
                alert('Ocorreu um erro inesperado. Tente novamente.');
                throw error;
            }
        }
    };

    const UI = {
        showSection(sectionId, tableId = null) {
            document.querySelectorAll('.section').forEach(s => s.style.display = 'none');
            const activeSection = document.getElementById(sectionId);
            if (activeSection) activeSection.style.display = 'block';

            document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
            const clickedButton = document.querySelector(`.tab-button[data-section-id="${sectionId}"]`);
            if (clickedButton) clickedButton.classList.add('active');

            if (sectionId === 'links-importantes') UI.loadLinksPage();
            else if (sectionId === 'visitas-encontros') UI.fetchVisitas();
            else if (tableId) {
                state.currentPage[tableId] = 1;
                UI.fetchResults(tableId, 1);
            }
        },
        populateDatalist(data, datalistId) {
            const datalist = document.getElementById(datalistId);
            if (!datalist) { console.warn(`DEBUG JS: Datalist com ID '${datalistId}' não encontrada.`); return; }
            datalist.innerHTML = data.map(item => `<option value="${item}">`).join('');
        },
        async loadAllDatalists() {
            try {
                const [allDatalistsData, pecsAndFormadoresData, responsaveisForPresencaData] = await Promise.all([
                    API.get('/api/datalists'),
                    API.get('/api/datalists/pecs_and_formadores'),
                    API.get('/api/datalists/responsaveis_for_presenca')
                ]);

                UI.populateDatalist(allDatalistsData.turmas, 'turmas-list');
                UI.populateDatalist(allDatalistsData.diretorias, 'diretorias-list');
                UI.populateDatalist(allDatalistsData.pecs, 'pecs-list');
                UI.populateDatalist(allDatalistsData.caffs, 'caffs-list');
                UI.populateDatalist(allDatalistsData.pautas_formativas, 'pautas-formativas-list');
                UI.populateDatalist(allDatalistsData.temas, 'temas-list-presenca');
                UI.populateDatalist(allDatalistsData.temas, 'temas-list-ateste');
                UI.populateDatalist(allDatalistsData.responsaveis, 'responsaveis-list-ateste');
                UI.populateDatalist(allDatalistsData.nomes, 'nomes-list-ateste');
                UI.populateDatalist(pecsAndFormadoresData, 'observadores-list');
                UI.populateDatalist(responsaveisForPresencaData, 'responsaveis-list');
                UI.populateDatalist(allDatalistsData.nomes, 'nomes-list-avaliacao');
                UI.populateDatalist(allDatalistsData.cpfs, 'cpfs-list');
                UI.populateDatalist(allDatalistsData.turmas, 'turmas-ocorrencia-list');
                UI.populateDatalist(allDatalistsData.temas, 'temas-ocorrencia-list');
                
                console.log("DEBUG JS: Todas as datalists carregadas.");
            } catch (e) {
                console.error('Falha ao carregar datalists:', e);
            }
        },
        renderTable(tableId, data) {
            const tableBody = document.querySelector(`#table-${tableId} tbody`);
            const tableHead = document.querySelector(`#table-${tableId} thead tr`);
            const { results, columns } = data;
            
            tableHead.innerHTML = '';
            tableBody.innerHTML = '';

            const isEditable = ['presenca', 'acompanhamento', 'avaliacao', 'demandas', 'ateste', 'usuarios', 'ocorrencias', 'visitas'].includes(tableId);
            if (isEditable) tableHead.innerHTML += '<th>Ações</th>';

            const columnOrder = { 
                'presenca': ['id', 'responsavel', 'turma', 'data_formacao', 'presenca', 'camera'], 
                'acompanhamento': ['id', 'responsavel_acompanhamento', 'turma', 'data_encontro', 'encontro_realizado'], 
                'avaliacao': ['id', 'observador', 'observado', 'data_acompanhamento', 'nota_final'] 
            };
            const orderedColumns = columnOrder[tableId] || columns;
            
            orderedColumns.forEach(col => {
                const th = document.createElement('th');
                th.textContent = AVALIACAO_QUESTIONS_MAP[col] || col.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                tableHead.appendChild(th);
            });

            if (results.length === 0) { tableBody.innerHTML = '<tr><td colspan="100%">Nenhum resultado encontrado.</td></tr>'; return; }

            results.forEach(row => {
                const tr = document.createElement('tr');
                if (isEditable) {
                    const canEdit = row.cpf === state.user.cpf || row.responsavel === state.user.nome || row.responsavel_acompanhamento === state.user.nome || state.user.accessLevel === 'super_admin';
                    tr.innerHTML += `<td>${canEdit ? `<button class="edit-button" data-id="${row.id}" data-table="${tableId}">Editar</button>` : ''}</td>`;
                }
                orderedColumns.forEach(col => {
                    let value = row[col] !== undefined ? row[col] : '';
                    if (col.includes('data_') || col.includes('_data')) value = new Date(value).toLocaleDateString('pt-BR');
                    tr.innerHTML += `<td>${value}</td>`;
                });
                tableBody.appendChild(tr);
            });
        },
        updateMetrics(tableId, metrics) {
            const container = document.getElementById(`metrics-${tableId}`);
            if (!container) return;
            for (const key in metrics) {
                const el = container.querySelector(`#${tableId}-${key}`);
                if (el) el.textContent = metrics[key];
            }
        },
        async fetchResults(tableId, page = 1) {
            const filters = new URLSearchParams(state.currentFilters[tableId] || {});
            filters.set('page', page);
            try {
                const data = await API.get(`/api/results/${tableId}?${filters.toString()}`);
                state.currentPage[tableId] = page;
                state.totalItems[tableId] = data.total_items;
                UI.renderTable(tableId, data);
                UI.updateMetrics(tableId, data.metrics);
                UI.renderPagination(tableId, data.total_items, page, data.per_page);
            } catch (e) {
                console.error(`Falha ao buscar resultados para ${tableId}:`, e);
            }
        },
        renderPagination(tableId, totalItems, currentPage, perPage) {
            const container = document.getElementById(`pagination-${tableId}`);
            if (!container) return;
            const totalPages = Math.ceil(totalItems / perPage);
            container.innerHTML = `
                <button class="pagination-button" data-action="prev" data-table="${tableId}" ${currentPage === 1 ? 'disabled' : ''}>Anterior</button>
                <span>Página ${currentPage} de ${totalPages}</span>
                <button class="pagination-button" data-action="next" data-table="${tableId}" ${currentPage >= totalPages ? 'disabled' : ''}>Próxima</button>
            `;
        },
        closeModal() {
            const modal = document.getElementById('editModal');
            modal.style.display = 'none';
            document.body.style.overflow = 'auto';
        },
        async openModal(recordId, tableId) {
            const modalContent = document.getElementById('editModalContent');
            modalContent.innerHTML = 'Carregando...';
            const modal = document.getElementById('editModal');
            modal.style.display = 'block';
            document.body.style.overflow = 'hidden';

            const url = tableId === 'usuarios' ? `/api/records/${tableId}/${recordId}` : `/api/records/${tableId}/${recordId}`;
            try {
                const record = await API.get(url);
                modalContent.innerHTML = MODAL_TEMPLATES[tableId](record);
            } catch (e) {
                modalContent.innerHTML = `<p style="color:red;">Erro ao carregar o registro: ${e.message}</p>`;
            }
        },
        async loadLinksPage() {
            const linksContainer = document.getElementById('links-container');
            try {
                const links = await API.get('/get_links');
                linksContainer.innerHTML = links.map(link => `
                    <div class="link-card">
                        <div class="link-info">
                            <h3><a href="${link.url}" target="_blank">${link.titulo}</a></h3>
                            <p>${link.descricao}</p>
                        </div>
                        <div class="link-image-container">
                            <img src="${link.imagem_url}" alt="${link.titulo}" class="link-image">
                        </div>
                    </div>
                `).join('');
            } catch (e) {
                console.error('ERRO JS: Erro ao carregar links:', e);
                linksContainer.innerHTML = '<p>Ocorreu um erro ao carregar os links.</p>';
            }
        },
        async loadLinksAdmin() {
            const linksAdminListBody = document.querySelector('#links-admin-list tbody');
            try {
                const links = await API.get('/admin/links');
                linksAdminListBody.innerHTML = links.map(link => `
                    <tr>
                        <td>${link.titulo}</td>
                        <td><a href="${link.url}" target="_blank">${link.url}</a></td>
                        <td>
                            <button class="edit-link-button" data-id="${link.id}">Editar</button>
                            <button class="delete-link-button red-button" data-id="${link.id}">Excluir</button>
                        </td>
                    </tr>
                `).join('');
            } catch (e) {
                console.error('ERRO JS: Erro ao carregar links:', e);
                linksAdminListBody.innerHTML = '<tr><td colspan="3">Erro ao carregar links.</td></tr>';
            }
        },
        async fetchAvisoDataForAdmin() {
            const avisoForm = document.getElementById('avisoForm');
            const avisoFormH3 = avisoForm.querySelector('h3');
            try {
                const aviso = await API.get('/admin/avisos');
                document.getElementById('aviso-titulo').value = aviso.titulo;
                document.getElementById('aviso-conteudo').value = aviso.conteudo;
                document.getElementById('aviso-imagem-url').value = aviso.imagem_url;
                if (avisoFormH3) avisoFormH3.textContent = 'Editar Aviso Existente';
            } catch (e) {
                if (e.message.includes('404')) {
                    if (avisoFormH3) avisoFormH3.textContent = 'Criar Novo Aviso';
                }
                console.warn('DEBUG JS: Aviso não encontrado ou erro ao carregar:', e);
            }
        },
        async fetchAviso() {
            const avisoModal = document.getElementById('aviso-modal');
            try {
                const aviso = await API.get('/admin/avisos');
                document.getElementById('aviso-modal-titulo').textContent = aviso.titulo;
                document.getElementById('aviso-modal-conteudo').textContent = aviso.conteudo;
                const imagemElement = document.getElementById('aviso-modal-imagem');
                if (aviso.imagem_url) {
                    imagemElement.src = aviso.imagem_url;
                    imagemElement.style.display = 'block';
                } else {
                    imagemElement.style.display = 'none';
                }
                avisoModal.style.display = 'block';
            } catch (e) {
                avisoModal.style.display = 'none';
                console.warn('DEBUG JS: Aviso não encontrado ou erro ao carregar:', e);
            }
        }
    };

    function setupEventListeners() {
        const presencaContainer = document.getElementById('participantes-container');
        if (presencaContainer) {
            presencaContainer.addEventListener('change', (e) => {
                const radio = e.target;
                if (radio.name.startsWith('presenca_')) {
                    const isPresent = radio.value === 'SIM';
                    const participanteDiv = radio.closest('.participante-item');
                    const cameraRadios = participanteDiv.querySelectorAll(`input[name^="camera_"]`);
                    cameraRadios.forEach(cameraRadio => {
                        cameraRadio.disabled = !isPresent;
                        if (!isPresent && cameraRadio.value === 'NÃO') cameraRadio.checked = true;
                        else if (isPresent && cameraRadio.value === 'SIM') cameraRadio.checked = true;
                    });
                }
            });
        }
        
        document.body.addEventListener('click', async function(e) {
            const target = e.target;
            if (target.matches('.tab-button')) {
                UI.showSection(target.dataset.sectionId, target.dataset.tableId);
            } else if (target.matches('.pagination-button')) {
                const tableId = target.dataset.table;
                let page = state.currentPage[tableId];
                if (target.dataset.action === 'next') page++;
                else if (target.dataset.action === 'prev') page--;
                UI.fetchResults(tableId, page);
            } else if (target.matches('.edit-button') || target.matches('.delete-button')) {
                const id = target.dataset.id;
                const table = target.closest('table').dataset.tableId;
                if (target.matches('.edit-button')) {
                    UI.openModal(id, table);
                } else if (target.matches('.delete-button')) {
                    if (confirm(`Tem certeza que deseja excluir o registro ID ${id} da tabela "${table}"?`)) {
                        await API.post('/api/delete/entry', { table, id });
                        UI.fetchResults(table, state.currentPage[table]);
                    }
                }
            } else if (target.matches('.reserve-visita-button')) {
                const recordId = target.dataset.id;
                if (confirm('Deseja reservar esta visita?')) {
                    await API.post('/api/visitas/reserve', { id: recordId });
                    UI.fetchVisitas();
                }
            }
        });

        document.body.addEventListener('change', async function(e) {
            const target = e.target;
            if (target.matches('#turma_presenca')) {
                const turma = target.value;
                const container = document.getElementById('participantes-container');
                container.innerHTML = '';
                if (turma) {
                    const participantes = await API.get(`/api/info/participantes_by_turma?turma=${encodeURIComponent(turma)}`);
                    container.innerHTML = participantes.map(p => `
                        <div class="participante-item" data-cpf="${p.cpf}" data-nome="${p.nome}" data-escola="${p.escola}" data-diretoria_de_ensino="${p.diretoria_de_ensino}">
                            <span class="participante-nome">${p.nome}</span>
                            <span class="participante-info">(${p.diretoria_de_ensino || 'N/A'} - ${p.escola || 'N/A'}) - ${p.etapa || 'N/A'}</span>
                            <div class="radio-group">
                                <label>Presença:<input type="radio" name="presenca_${p.cpf}" value="SIM" required> SIM<input type="radio" name="presenca_${p.cpf}" value="NÃO"> NÃO</label>
                                <label>Câmera:<input type="radio" name="camera_${p.cpf}" value="SIM" required> SIM<input type="radio" name="camera_${p.cpf}" value="NÃO"> NÃO</label>
                            </div>
                        </div>
                    `).join('');
                }
            }
        });

        document.body.addEventListener('submit', async function(e) {
            e.preventDefault();
            const form = e.target;
            let data = Object.fromEntries(new FormData(form).entries());
            let endpoint, successMessage;

            switch (form.id) {
                case 'formPresenca':
                    data = { ...data, participantes: {} };
                    form.querySelectorAll('.participante-item').forEach(item => {
                        const cpf = item.dataset.cpf;
                        data.participantes[cpf] = {
                            nome: item.dataset.nome,
                            cpf,
                            escola: item.dataset.escola,
                            diretoria_de_ensino: item.dataset.diretoria_de_ensino,
                            presenca: form.querySelector(`input[name="presenca_${cpf}"]:checked`)?.value,
                            camera: form.querySelector(`input[name="camera_${cpf}"]:checked`)?.value,
                        };
                    });
                    endpoint = '/submit/presenca';
                    successMessage = 'Registro de presença enviado com sucesso!';
                    break;
                case 'formAcompanhamento':
                    endpoint = '/submit/acompanhamento';
                    successMessage = 'Acompanhamento de encontro salvo com sucesso!';
                    break;
                // Adicione os outros formulários aqui
                default:
                    return;
            }
            if (endpoint) {
                await API.post(endpoint, data);
            }
        });
    }

    async function initializeApp() {
        try {
            const userData = await API.get('/get_user_info');
            state.user = userData;

            const visibilityData = await API.get('/get_visibility').catch(() => ({ hidden_elements: {} }));
            state.visibility = visibilityData.hidden_elements;
            
            const accessMap = {
                'basic_access': ['tab-form-presenca', 'tab-form-ocorrencia', 'tab-resultados-presenca', 'tab-resultados-ocorrencias'],
                'power_user': ['tab-form-presenca', 'tab-form-acompanhamento', 'tab-form-avaliacao', 'tab-form-demandas', 'tab-form-ocorrencia', 'tab-visitas-encontros', 'tab-resultados-presenca', 'tab-resultados-acompanhamento', 'tab-resultados-avaliacao', 'tab-resultados-demandas', 'tab-resultados-ocorrencias', 'tab-controle-ateste', 'tab-painel-bi', 'tab-links-importantes'],
                'super_admin': ['tab-form-presenca', 'tab-form-acompanhamento', 'tab-form-avaliacao', 'tab-form-demandas', 'tab-form-ocorrencia', 'tab-visitas-encontros', 'tab-resultados-presenca', 'tab-resultados-acompanhamento', 'tab-resultados-avaliacao', 'tab-resultados-demandas', 'tab-resultados-ocorrencias', 'tab-controle-ateste', 'tab-painel-bi', 'tab-links-importantes', 'tab-admin-tools']
            };

            const visibleElements = accessMap[state.user.accessLevel] || [];
            document.querySelectorAll('.tab-button').forEach(button => {
                const isHidden = state.visibility[button.dataset.sectionId] || state.visibility[button.id];
                if (visibleElements.includes(button.id) && !isHidden) {
                    button.style.display = 'inline-block';
                }
            });

            const defaultSectionId = document.getElementById(visibleElements[0])?.dataset.sectionId;
            const defaultTableId = document.getElementById(visibleElements[0])?.dataset.tableId;
            if (defaultSectionId) {
                UI.showSection(defaultSectionId, defaultTableId);
            }

            await UI.loadAllDatalists();
            await UI.loadLinksPage();
            await UI.fetchAviso();
            setupLogoutButton();
            setupEventListeners();
            console.log("DEBUG JS: checkAccessAndInitializeUI concluído.");

        } catch (e) {
            console.error("Erro na inicialização:", e);
            window.location.href = '/login';
        }
    }

    function setupLogoutButton() {
        const headerContent = document.querySelector('.header-content');
        if (!headerContent) return;
        
        let logoutButton = headerContent.querySelector('.logout-button');
        if (logoutButton) {
            logoutButton.remove();
        }

        logoutButton = document.createElement('button');
        logoutButton.textContent = 'Sair';
        logoutButton.classList.add('logout-button');
        logoutButton.onclick = async () => {
            await API.get('/logout');
            window.location.href = '/login';
        };
        headerContent.appendChild(logoutButton);
    }

    initializeApp();
});