/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

document.addEventListener('DOMContentLoaded', function() {
    console.log("DEBUG JS: DOM totalmente carregado e pronto para a ação.");

    // Variáveis de estado para paginação (agora globais no escopo do DOMContentLoaded)
    const currentPage = {};
    const totalItems = {};
    const currentFilters = {};
    let allParticipantsCache = [];

    const AVALIACAO_QUESTIONS_MAP = {
        'q1_1': '1.1 - Promove um ambiente virtual seguro, respeitoso e acolhedor, prevenindo condutas inadequadas e incentivando a observância da ética nas interações, em conformidade com as diretrizes do Programa.',
        'q1_2': '1.2 - Conduz a formação em ambiente adequado, utilizando o background do Programa Multiplica SP, bem como condições apropriadas de iluminação, comportamento e execução.',
        'q1_3': '1.3 - Estimula os demais participantes a seguirem as regras de etiqueta, enfatizando a importância dessa prática para a qualidade das formações.',
        'q2_1': '2.1 - Inicia a formação no horário determinado.',
        '2.2': '2.2 - Gerencia o tempo assegurando a realização das atividades propostas na pauta, priorizando a qualidade das trocas e a participação.',
        'q2_3': '2.3 - Encerra a formação no horário estipulado.',
        'q3_1': '3.1 - Utiliza estratégias e técnicas que favoreçam a participação de todos.',
        'q3_2': '3.2 - Estimulados pelo formador, os participantes contribuem de alguma forma com a formação e demonstram compromisso com as atividades.',
        'q3_3': '3.3 - Gerencia o tempo de forma eficiente, para a participação dos cursistas e dos formadores.',
        'q4_1': '4.1 - Utiliza vocabulário acessível e de fácil compreensão pelos participantes.',
        '4.2': '4.2 - Faz perguntas disparadoras, coerentes com o conteúdo disposto na Pauta, a fim de melhor conduzir as discussões.',
        '4.3': '4.3 - As discussões se mantêm produtivas e alinhadas ao objetivo da Pauta, evitando digressões.',
        'q5_1': '5.1 - Demonstra domínio do conteúdo proposto na Pauta, por meio de explicações embasadas nas referências.',
        '5.2': '5.2 - Promove e estimula exemplos práticos para que conexões com a realidade escolar sejam estabelecidas.',
        '5.3': '5.3 - Assegura que a formação aconteça numa sequência lógica e progressiva, promovendo a qualidade das etapas do Percurso Formativo.'
    };

    const DIMENSIONS_CONFIG = {
        'Dimensão 1': { questions: ['q1_1', 'q1_2', 'q1_3'], weight: 1 },
        'Dimensão 2': { questions: ['q2_1', 'q2_2', 'q2_3'], weight: 2 },
        'Dimensão 3': { questions: ['q3_1', 'q3_2', 'q3_3'], weight: 2 },
        'Dimensão 4': { questions: ['q4_1', 'q4_2', 'q4_3'], weight: 2 },
        'Dimensão 5': { questions: ['q5_1', 'q5_2', 'q5_3'], weight: 2 }
    };

    const SCORE_MAP = { 'Atende': 1, 'Não Atende': 0 };

    function calculateScore() {
        const form = document.getElementById('formAvaliacao');
        let totalWeightedAchievedScore = 0;
        let totalPossibleWeightedScore = 0;

        for (const dimName in DIMENSIONS_CONFIG) {
            const { questions, weight } = DIMENSIONS_CONFIG[dimName];
            let dimensionCurrentRawScore = 0;
            let answeredQuestionsInDimension = 0;

            questions.forEach(q => {
                const selected = form.querySelector(`input[name="${q}"]:checked`);
                if (selected) {
                    dimensionCurrentRawScore += SCORE_MAP[selected.value] !== undefined ? SCORE_MAP[selected.value] : 0;
                    answeredQuestionsInDimension++;
                }
            });

            if (answeredQuestionsInDimension > 0) {
                const proportion = dimensionCurrentRawScore / questions.length;
                totalWeightedAchievedScore += proportion * weight;
                totalPossibleWeightedScore += weight;
            }
        }
        
        const finalScore = totalPossibleWeightedScore > 0 ? (totalWeightedAchievedScore / totalPossibleWeightedScore) * 10 : 0;
        document.getElementById('nota_final_avaliacao').value = finalScore.toFixed(2);
        console.log(`DEBUG JS: Nota final calculada: ${finalScore.toFixed(2)}`);
    }

    function handlePresencaRadioChange(participanteDiv, isPresent) {
        const cameraRadios = participanteDiv.querySelectorAll(`input[name="camera_${participanteDiv.dataset.cpf}"]`);
        cameraRadios.forEach(cameraRadio => {
            if (!isPresent) {
                cameraRadio.disabled = true;
                if (cameraRadio.value === 'NÃO') {
                    cameraRadio.checked = true;
                } else {
                    cameraRadio.checked = false;
                }
            } else {
                cameraRadio.disabled = false;
                if (cameraRadio.value === 'SIM') {
                    cameraRadio.checked = true;
                }
            }
        });
    }

    function toggleSubstituto(radioGroup) {
        const selectedValue = radioGroup.querySelector('input:checked')?.value;
        const formadorAssistidoInput = document.getElementById('formador_assistido');
        const substitutoContainer = document.getElementById('substituto-container');
        const nomeSubstitutoInput = document.getElementById('nome_substituto');
        const turmaInput = document.getElementById('turma_acompanhamento');

        if (selectedValue === 'nao_se_aplica') {
            formadorAssistidoInput.value = 'Não se aplica';
            formadorAssistidoInput.readOnly = true;
            substitutoContainer.style.display = 'block';
            nomeSubstitutoInput.required = true;
        } else {
            formadorAssistidoInput.readOnly = false;
            substitutoContainer.style.display = 'none';
            nomeSubstitutoInput.required = false;
            if (turmaInput.value) {
                turmaInput.dispatchEvent(new Event('change'));
            }
        }
    }

    function toggleSchoolSelection(radioGroup) {
        const selectedValue = radioGroup.querySelector('input:checked')?.value;
        const escolasContainer = document.getElementById('escolas-container');
        const escolasCheckboxContainer = document.getElementById('escolas-checkbox-container');
        const pmOrientadosInput = document.getElementById('pm_orientados_demandas');
        const cursistasOrientadosInput = document.getElementById('cursistas_orientados_demandas');
        const pmOrientadosEsperadoInput = document.getElementById('pm_orientados_esperado_demandas');
        const cursistasOrientadosEsperadoInput = document.getElementById('cursistas_orientados_esperado_demandas');

        console.log(`DEBUG JS: Visitas às escolas: ${selectedValue}`);
        if (escolasContainer) {
            if (selectedValue === 'Sim') {
                escolasContainer.style.display = 'block';
                loadSchoolsByDiretoria();
            } else {
                escolasContainer.style.display = 'none';
                if (escolasCheckboxContainer) escolasCheckboxContainer.innerHTML = '';
                if (pmOrientadosInput) pmOrientadosInput.value = 0;
                if (cursistasOrientadosInput) cursistasOrientadosInput.value = 0;
                if (pmOrientadosEsperadoInput) pmOrientadosEsperadoInput.value = 0;
                if (cursistasOrientadosEsperadoInput) cursistasOrientadosEsperadoInput.value = 0;
            }
        }
    }

    async function countParticipants() {
        const escolasCheckboxContainer = document.getElementById('escolas-checkbox-container');
        if (!escolasCheckboxContainer) return;
        const selectedSchools = Array.from(escolasCheckboxContainer.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => checkbox.value);
        console.log(`DEBUG JS: Contando participantes para escolas selecionadas: ${selectedSchools.join(', ')}`);
        if (selectedSchools.length > 0) {
            try {
                const response = await fetch(`/api/counts/participants_by_schools?escolas=${encodeURIComponent(selectedSchools.join(','))}`);
                if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                    }
                const data = await response.json();
                
                const pmOrientadosEsperadoInput = document.getElementById('pm_orientados_esperado_demandas');
                const cursistasOrientadosEsperadoInput = document.getElementById('cursistas_orientados_esperado_demandas');

                if (pmOrientadosEsperadoInput) pmOrientadosEsperadoInput.value = data.pm_total;
                if (cursistasOrientadosEsperadoInput) cursistasOrientadosEsperadoInput.value = data.pc_total;
                
                console.log(`DEBUG JS: Total PMs na UE: ${data.pm_total}, Total PCs na UE: ${data.pc_total}`);
            } catch (error) {
                console.error('ERRO JS: Erro ao contar participantes:', error);
                const pmOrientadosEsperadoInput = document.getElementById('pm_orientados_esperado_demandas');
                const cursistasOrientadosEsperadoInput = document.getElementById('cursistas_orientados_esperado_demandas');
                if (pmOrientadosEsperadoInput) pmOrientadosEsperadoInput.value = 0;
                if (cursistasOrientadosEsperadoInput) cursistasOrientadosEsperadoInput.value = 0;
            }
        } else {
            const pmOrientadosInput = document.getElementById('pm_orientados_demandas');
            const cursistasOrientadosInput = document.getElementById('cursistas_orientados_demandas');
            const pmOrientadosEsperadoInput = document.getElementById('pm_orientados_esperado_demandas');
            const cursistasOrientadosEsperadoInput = document.getElementById('cursistas_orientados_esperado_demandas');
            if (pmOrientadosInput) pmOrientadosInput.value = 0;
            if (cursistasOrientadosInput) cursistasOrientadosInput.value = 0;
            if (pmOrientadosEsperadoInput) pmOrientadosEsperadoInput.value = 0;
            if (cursistasOrientadosEsperadoInput) cursistasOrientadosEsperadoInput.value = 0;
        }
    }

    function populateDatalist(data, datalistId) {
        const datalist = document.getElementById(datalistId);
        if (!datalist) {
            console.warn(`DEBUG JS: Datalist com ID '${datalistId}' não encontrada.`);
            return;
        }
        datalist.innerHTML = '';
        if (data && Array.isArray(data)) {
            data.forEach(item => {
                const option = document.createElement('option');
                option.value = item;
                datalist.appendChild(option);
            });
            console.log(`DEBUG JS: Datalist '${datalistId}' populada com ${data.length} itens.`);
        }
    }

    async function fetchData(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                const errorText = await response.text();
                const errorData = JSON.parse(errorText);
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`ERRO API: Falha ao buscar dados de ${url}:`, error);
            throw error;
        }
    }

    async function submitFormData(endpoint, data) {
        try {
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            const result = await response.json();
            if (!response.ok) {
                const errorMessage = result.message || `HTTP error! status: ${response.status}`;
                if (response.status === 403) {
                    alert('Acesso negado para enviar este formulário. Nível de permissão insuficiente.');
                } else if (response.status === 409) {
                    alert(errorMessage);
                } else {
                    alert('Ocorreu um erro ao enviar o formulário: ' + errorMessage);
                }
                throw new Error(errorMessage);
            }
            return result;
        } catch (error) {
            console.error('ERRO API: Erro ao enviar o formulário ou processar a resposta:', error);
            alert('Ocorreu um erro inesperado ao enviar o formulário. Por favor, tente novamente.');
            throw error;
        }
    }

    async function loadAllDatalists() {
        console.log("DEBUG JS: Carregando todas as datalists de uma vez...");
        try {
            const [allDatalistsData, pecsAndFormadoresData, responsaveisForPresencaData] = await Promise.all([
                fetchData('/api/datalists'),
                fetchData('/api/datalists/pecs_and_formadores'),
                fetchData('/api/datalists/responsaveis_for_presenca')
            ]);

            populateDatalist(allDatalistsData.turmas, 'turmas-list');
            populateDatalist(allDatalistsData.diretorias, 'diretorias-list');
            populateDatalist(allDatalistsData.pecs, 'pecs-list');
            populateDatalist(allDatalistsData.caffs, 'caffs-list');
            populateDatalist(allDatalistsData.pautas_formativas, 'pautas-formativas-list');
            populateDatalist(allDatalistsData.temas, 'temas-list-presenca');
            populateDatalist(allDatalistsData.temas, 'temas-list-ateste');
            populateDatalist(allDatalistsData.responsaveis, 'responsaveis-list-ateste');
            populateDatalist(allDatalistsData.nomes, 'nomes-list-ateste');
            populateDatalist(pecsAndFormadoresData, 'observadores-list');
            populateDatalist(responsaveisForPresencaData, 'responsaveis-list');
            populateDatalist(allDatalistsData.nomes, 'nomes-list-avaliacao');
            populateDatalist(allDatalistsData.cpfs, 'cpfs-list');
            populateDatalist(allDatalistsData.turmas, 'turmas-ocorrencia-list');
            populateDatalist(allDatalistsData.temas, 'temas-ocorrencia-list');
            
            console.log("DEBUG JS: Todas as datalists carregadas.");

        } catch (error) {
            console.error('ERRO JS: Erro ao carregar datalists:', error);
        }
    }

    async function fetchVisitas() {
        console.log("DEBUG JS: Buscando dados de visitação...");
        const visitasTableBody = document.getElementById('visitas-table-body');
        if (!visitasTableBody) return;

        visitasTableBody.innerHTML = '<tr><td colspan="8">Carregando dados...</td></tr>';

        try {
            const userResponse = await fetchData('/get_user_info');
            const userAccessLevel = userResponse.access_level;
            const userName = userResponse.nome;

            const filterForm = document.getElementById('filterFormVisitas');
            const formData = new FormData(filterForm);
            const queryParams = new URLSearchParams(formData).toString();

            const data = await fetchData(`/api/visitas?${queryParams}`);
            console.log("DEBUG JS: Dados de visitação recebidos:", data);

            visitasTableBody.innerHTML = '';
            if (data.results.length > 0) {
                data.results.forEach(record => {
                    const tr = document.createElement('tr');
                    
                    let actionsHtml = '';
                    if (record.responsavel_visitacao) {
                        const isEditable = record.responsavel_visitacao === userName || userAccessLevel === 'super_admin';
                        if (isEditable) {
                            actionsHtml = `<button class="edit-visita-button" data-id="${record.id}">Editar</button>
                                        <button class="delete-visita-button red-button" data-id="${record.id}">Cancelar</button>`;
                        } else {
                            actionsHtml = `<span>Reservado</span>`;
                        }
                    } else {
                        actionsHtml = `<button class="reserve-visita-button" data-id="${record.id}">Reservar</button>`;
                    }

                    tr.innerHTML = `
                        <td>${actionsHtml}</td>
                        <td>${record.responsavel_visitacao || 'Não Reservado'}</td>
                        <td>${record.encontro_aconteceu}</td>
                        <td>${record.turma || 'N/A'}</td>
                        <td>${record.tema || 'N/A'}</td>
                        <td>${record.data_formacao ? new Date(record.data_formacao).toLocaleDateString('pt-BR') : 'N/A'}</td>
                        <td>${record.horario || 'N/A'}</td>
                        <td><a href="${record.url}" target="_blank">Acessar</a></td>
                    `;
                    visitasTableBody.appendChild(tr);
                });
            } else {
                visitasTableBody.innerHTML = '<tr><td colspan="8">Nenhum encontro disponível para visitação.</td></tr>';
            }

            const metricsContainer = document.getElementById('metrics-visitas');
            if (metricsContainer) {
                metricsContainer.querySelector('#visitas-total_formacoes').textContent = data.metrics.total_formacoes || 0;
                metricsContainer.querySelector('#visitas-formacoes_visitadas').textContent = data.metrics.formacoes_visitadas || 0;
                metricsContainer.querySelector('#visitas-formacoes_com_problemas').textContent = data.metrics.formacoes_com_problemas || 0;
                metricsContainer.querySelector('#visitas-pct_visitacao').textContent = data.metrics.pct_visitacao || '0.00%';
            }

        } catch (error) {
            console.error('ERRO JS: Erro ao carregar visitações:', error);
            visitasTableBody.innerHTML = `<tr><td colspan="8" style="color:red;">Erro ao carregar dados: ${error.message}</td></tr>`;
        }
    }

    async function fetchResults(tableId, page = 1) {
        console.log(`DEBUG JS: Buscando resultados para a tabela: ${tableId}, página: ${page}`);
        const resultsTableBody = document.querySelector(`#table-${tableId} tbody`);
        const tableHeadRow = document.querySelector(`#table-${tableId} thead tr`);
        const metricsContainer = document.querySelector(`#metrics-${tableId}`);
        const paginationContainer = document.querySelector(`#pagination-${tableId}`);

        if (!resultsTableBody || !tableHeadRow) {
            console.error(`ERRO JS: Componentes de tabela para '${tableId}' não encontrados.`);
            return;
        }

        resultsTableBody.innerHTML = '<tr><td colspan="100%">Carregando dados...</td></tr>';
        tableHeadRow.innerHTML = '';
        if (paginationContainer) paginationContainer.innerHTML = '';

        let queryParams = new URLSearchParams(currentFilters[tableId]);
        queryParams.set('page', page);

        try {
            const data = await fetchData(`/api/results/${tableId}?${queryParams.toString()}`);

            const results = data.results;
            const columns = data.columns;
            const totalItemsCount = data.total_items;
            const perPage = data.per_page;

            currentPage[tableId] = page;
            totalItems[tableId] = totalItemsCount;
            
            const userResponse = await fetchData('/get_user_info');
            const userData = userResponse;
            const userAccessLevel = userData.access_level;
            const userCpf = userData.cpf;
            const userName = userData.nome;
            const userEmail = userData.email;

            const columnDisplayNames = {
                'id': 'ID', 'responsavel_acompanhamento': 'Responsável pelo Acompanhamento', 'formador_assistido': 'Responsável pela Formação',
                'encontro_realizado': 'Encontro Realizado?', 'num_participantes_esperados': 'Participantes Esperados',
                'real_participantes': 'Participantes Reais', 'camera_aberta_participantes': 'Câmera Aberta',
                'motivo_nao_ocorrencia': 'Motivo Não Ocorrência', 'data_encontro': 'Data do Encontro', 'semana': 'Semana',
                'diretoria_de_ensino_resp': 'Diretoria do Responsável', 'responsavel': 'Responsável',
                'substituicao_ocorreu': 'Houve Substituição?', 'nome_substituto': 'Nome do Substituto',
                'tema': 'Tema', 'turma': 'Turma', 'data_formacao': 'Data da Formação', 'pauta': 'Pauta Formativa',
                'observacao': 'Observação', 'nome_participante': 'Nome do Participante', 'cpf_participante': 'CPF do Participante',
                'escola_participante': 'Escola do Participante', 'de_participante': 'DE do Participante', 'di_participante': 'DI',
                'pei_participante': 'PEI', 'declinou_participante': 'Declinou', 'presenca': 'Presença', 'camera': 'Câmera',
                'observador': 'Observador', 'funcao': 'Função', 'data_acompanhamento': 'Data Acompanhamento',
                'data_feedback': 'Data Feedback', 'observado': 'Nome Observado', 'cpf_observado': 'CPF Observado',
                'diretoria_de_ensino': 'Diretoria de Ensino', 'escola': 'Escola', 'tema_observado': 'Tema Observado',
                'codigo_turma': 'Código da Turma', 'pauta_formativa': 'Pauta Formativa', 'link_gravacao': 'Link Gravação',
                'nota_final': 'Nota Final', 'feedback_estruturado': 'Feedback Estruturado', 'observacoes_gerais': 'Observações Gerais',
                'pec': 'PEC Multiplica', 'cpf_pec': 'CPF do PEC', 'caff': 'CAFF Responsável', 'formacoes_realizadas': 'Formações Realizadas',
                'alinhamento_semanal': 'Alinhamento Semanal Síncrono', 'alinhamento_geral': 'Alinhamento Geral Síncrono',
                'visitas_escolas': 'Visitas às Escolas', 'escolas_visitadas': 'Escolas Visitadas', 'pm_orientados': 'PMs Orientados',
                'cursistas_orientados': 'Cursistas Orientados', 'pm_orientados_esperado': 'PMs na UE',
                'cursistas_orientados_esperado': 'Cursistas na UE', 'rubricas_preenchidas': 'Rubricas Preenchidas',
                'feedbacks_realizados': 'Feedbacks Realizados', 'substituicoes_realizadas': 'Substituições Realizadas',
                'engajamento': 'Ações de Engajamento', 'valor_formacao': 'Valor da Formação', 'nome': 'Nome', 'cpf': 'CPF',
                'etapa': 'Etapa', 'di': 'DI', 'pei': 'PEI', 'declinou': 'Declinou', 'password_hash': 'Hash da Senha',
                'access_level': 'Nível de Acesso', 'tipo_ocorrencia': 'Tipo de Ocorrência', 'outra_ocorrencia_desc': 'Outra Ocorrência',
                'descricao_problema': 'Descrição', 'ocorrencia_ainda_ocorre': 'Ainda ocorre?', 'nivel_impacto': 'Nível de Impacto',
                'data_horario': 'Data/Hora', 'responsavel_visitacao': 'Responsável Visitação', 'encontro_aconteceu': 'Encontro Aconteceu?',
                'motivo_nao_aconteceu': 'Motivo Não Aconteceu', 'url': 'URL do Encontro', 'tenant': 'Tenant',
                'segmento': 'Segmento', 'nome_responsavel_base': 'Responsável Base', 'cpf_responsavel_base': 'CPF Responsável Base',
                'email': 'E-mail', 'mes': 'Mês',
            };

            const desiredOrder = {
                'presenca': ['id', 'diretoria_de_ensino_resp', 'responsavel', 'substituicao_ocorreu', 'nome_substituto', 'tema', 'turma', 'data_formacao', 'pauta', 'observacao', 'nome_participante', 'cpf_participante', 'escola_participante', 'de_participante', 'di_participante', 'pei_participante', 'declinou_participante', 'presenca', 'camera'],
                'acompanhamento': [ 'id', 'responsavel_acompanhamento', 'formador_assistido', 'turma', 'tema', 'pauta', 'data_encontro', 'semana', 'encontro_realizado', 'dia_semana_encontro', 'horario_encontro', 'esperado_participantes', 'real_participantes', 'camera_aberta_participantes', 'motivo_nao_ocorrencia', 'observacao'],
                'demandas': ['id', 'pec', 'cpf_pec', 'semana', 'caff', 'diretoria_de_ensino', 'formacoes_realizadas', 'alinhamento_semanal', 'visitas_escolas', 'escolas_visitadas', 'pm_orientados', 'cursistas_orientados', 'pm_orientados_esperado', 'cursistas_orientados_esperado', 'rubricas_preenchidas', 'feedbacks_realizados', 'substituicoes_realizadas', 'engajamento', 'observacao'],
                'ateste': ['id', 'responsavel_base', 'nome_quem_preencheu', 'tema', 'turma', 'data_formacao', 'diretoria_de_ensino', 'escola', 'cpf', 'valor_formacao'],
                'participantes_base_editavel': ['cpf', 'nome', 'escola', 'diretoria_de_ensino', 'tema', 'responsavel', 'turma', 'etapa', 'di', 'pei', 'declinou'],
                'usuarios': ['id', 'cpf', 'access_level'],
                'ocorrencias': ['id', 'nome', 'email', 'telefone', 'turma', 'tema', 'tipo_ocorrencia', 'outra_ocorrencia_desc', 'descricao_problema', 'ocorrencia_ainda_ocorre', 'nivel_impacto', 'data_horario'],
                'visitas': ['id', 'responsavel_visitacao', 'encontro_aconteceu', 'turma', 'tema', 'data_formacao', 'horario', 'url', 'observacao']
            };

            let orderedColumns = [];
            if (desiredOrder[tableId]) {
                orderedColumns = desiredOrder[tableId].filter(col => columns.includes(col));
                const remainingCols = columns.filter(col => !desiredOrder[tableId].includes(col));
                orderedColumns = orderedColumns.concat(remainingCols.sort());
            } else {
                orderedColumns = columns;
            }

            const tableHead = document.querySelector(`#table-${tableId} thead tr`);
            tableHead.innerHTML = '';
            const isEditableTable = ['presenca', 'acompanhamento', 'avaliacao', 'demandas', 'ateste', 'participantes_base_editavel', 'usuarios', 'ocorrencias', 'visitas'].includes(tableId);

            if (isEditableTable) {
                const thActions = document.createElement('th');
                thActions.textContent = 'Ações';
                tableHead.appendChild(thActions);
            }

            orderedColumns.forEach(colName => {
                const th = document.createElement('th');
                th.textContent = AVALIACAO_QUESTIONS_MAP[colName] || columnDisplayNames[colName] || colName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                th.title = AVALIACAO_QUESTIONS_MAP[colName] || columnDisplayNames[colName] || colName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                tableHead.appendChild(th);
            });
            
            resultsTableBody.innerHTML = '';
            if (results.length === 0) {
                resultsTableBody.innerHTML = '<tr><td colspan="100%">Nenhum resultado encontrado.</td></tr>';
            } else {
                results.forEach(docData => {
                    const tr = document.createElement('tr');
                    
                    if (isEditableTable) {
                        const tdActions = document.createElement('td');
                        
                        let canEdit = false;
                        if (userAccessLevel === 'super_admin') {
                            canEdit = true;
                        } else {
                            switch (tableId) {
                                case 'presenca':
                                    canEdit = docData.cpf_participante === userCpf || docData.responsavel === userName || docData.nome_substituto === userName;
                                    break;
                                case 'acompanhamento':
                                    canEdit = docData.responsavel_acompanhamento === userName;
                                    break;
                                case 'avaliacao':
                                    canEdit = docData.observador === userName;
                                    break;
                                case 'demandas':
                                    canEdit = docData.cpf_pec === userCpf;
                                    break;
                                case 'ateste':
                                    canEdit = docData.cpf === userCpf;
                                    break;
                                case 'usuarios':
                                    canEdit = docData.cpf === userCpf;
                                    break;
                                case 'ocorrencias':
                                    canEdit = docData.email === userEmail;
                                    break;
                                case 'visitas':
                                    canEdit = docData.responsavel_visitacao === userName;
                                    break;
                            }
                        }

                        if (canEdit) {
                            const editButton = document.createElement('button');
                            editButton.textContent = 'Editar';
                            editButton.classList.add('edit-button');
                            const recordIdentifier = tableId === 'participantes_base_editavel' || tableId === 'usuarios' ? docData.cpf : docData.id;
                            editButton.onclick = () => openEditModal(recordIdentifier, tableId);
                            tdActions.appendChild(editButton);

                            const deleteButton = document.createElement('button');
                            deleteButton.textContent = 'Excluir';
                            deleteButton.classList.add('delete-button', 'red-button');
                            deleteButton.onclick = () => handleDeleteRecord(recordIdentifier, tableId, docData.turma, docData.data_formacao, docData.pauta);
                            tdActions.appendChild(deleteButton);
                        } else {
                            tdActions.textContent = 'Sem permissão';
                        }
                        tr.appendChild(tdActions);
                    }

                    orderedColumns.forEach(col => {
                        const td = document.createElement('td');
                        let cellValue = docData[col];
                        if (col === 'valor_formacao') {
                            cellValue = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cellValue);
                        } else if (Array.isArray(cellValue)) {
                            td.textContent = cellValue.join(', ');
                        } else if (col.includes('data_') || col.includes('_data')) {
                            const dateObj = new Date(cellValue);
                            const formattedDate = new Date(dateObj.getTime() + dateObj.getTimezoneOffset() * 60000).toLocaleDateString('pt-BR');
                            td.textContent = formattedDate;
                        } else {
                            td.textContent = cellValue !== undefined && cellValue !== null ? cellValue : '';
                        }
                        tr.appendChild(td);
                    });
                    resultsTableBody.appendChild(tr);
                });
            }

            if (paginationContainer) {
                const totalPages = Math.ceil(totalItemsCount / perPage);
                paginationContainer.innerHTML = `
                    <button id="prevPage${tableId}" class="pagination-button" ${page === 1 ? 'disabled' : ''}>Anterior</button>
                    <span>Página ${page} de ${totalPages}</span>
                    <button id="nextPage${tableId}" class="pagination-button" ${page >= totalPages ? 'disabled' : ''}>Próxima</button>
                `;
                document.getElementById(`prevPage${tableId}`).addEventListener('click', () => fetchResults(tableId, page - 1));
                document.getElementById(`nextPage${tableId}`).addEventListener('click', () => fetchResults(tableId, page + 1));
            }

            if (metricsContainer) {
                if (tableId === 'presenca') {
                    const numForms = metricsContainer.querySelector(`#presenca-num_formularios`);
                    if (numForms) numForms.textContent = data.metrics.num_formularios || 0;
                    const presentes = metricsContainer.querySelector(`#presenca-presentes`);
                    if (presentes) presentes.textContent = data.metrics.presentes || 0;
                    const esperados = metricsContainer.querySelector(`#presenca-esperados`);
                    if (esperados) esperados.textContent = data.metrics.esperados || 0;
                    const pctPresenca = metricsContainer.querySelector(`#presenca-pct_presenca`);
                    if (pctPresenca) pctPresenca.textContent = data.metrics.pct_presenca || "0.00%";
                    const pctCamera = metricsContainer.querySelector(`#presenca-pct_camera`);
                    if (pctCamera) pctCamera.textContent = data.metrics.pct_camera || "0.00%";
                } else if (tableId === 'acompanhamento') {
                    if (metricsContainer.querySelector('#acompanhamento-num_acompanhamentos')) {
                        metricsContainer.querySelector('#acompanhamento-num_acompanhamentos').textContent = data.metrics.num_acompanhamentos || 0;
                    }
                    if (metricsContainer.querySelector('#acompanhamento-num_encontros_ocorridos')) {
                        metricsContainer.querySelector('#acompanhamento-num_encontros_ocorridos').textContent = data.metrics.num_encontros_ocorridos || 0;
                    }
                    if (metricsContainer.querySelector('#acompanhamento-num_participantes_esperados')) {
                        metricsContainer.querySelector('#acompanhamento-num_participantes_esperados').textContent = data.metrics.num_participantes_esperados || 0;
                    }
                    if (metricsContainer.querySelector('#acompanhamento-num_participantes_reais')) {
                        metricsContainer.querySelector('#acompanhamento-num_participantes_reais').textContent = data.metrics.num_participantes_reais || 0;
                    }
                    if (metricsContainer.querySelector('#acompanhamento-num_camera_aberta')) {
                        metricsContainer.querySelector('#acompanhamento-num_camera_aberta').textContent = data.metrics.num_camera_aberta || 0;
                    }
                } else if (tableId === 'avaliacao') {
                    const numForms = metricsContainer.querySelector(`#avaliacao-num_formularios`);
                    if (numForms) numForms.textContent = data.metrics.num_formularios || 0;
                    const mediaNotas = metricsContainer.querySelector(`#avaliacao-media_notas`);
                    if (mediaNotas) mediaNotas.textContent = data.metrics.nota_media || "0.00";
                } else if (tableId === 'demandas') {
                    const numForms = metricsContainer.querySelector(`#demandas-num_formularios`);
                    if (numForms) numForms.textContent = data.metrics.num_formularios || 0;
                    const numEscolasVisitadasUnicas = metricsContainer.querySelector(`#demandas-num_escolas_visitadas_unicas`);
                    if (numEscolasVisitadasUnicas) numEscolasVisitadasUnicas.textContent = data.metrics.num_escolas_visitadas_unicas || 0;

                    const totalPmsOrientados = metricsContainer.querySelector(`#demandas-total_pms_orientados`);
                    const totalPmsEsperados = metricsContainer.querySelector(`#demandas-total_pms_esperados`);
                    if (totalPmsOrientados && totalPmsEsperados) {
                        totalPmsOrientados.textContent = data.metrics.total_pms_orientados || 0;
                        totalPmsEsperados.textContent = data.metrics.total_pms_esperados || 0;
                    }
                    
                    const totalCursistasOrientados = metricsContainer.querySelector(`#demandas-total_cursistas_orientados`);
                    const totalCursistasEsperados = metricsContainer.querySelector(`#demandas-total_cursistas_esperados`);
                    if (totalCursistasOrientados && totalCursistasEsperados) {
                        totalCursistasOrientados.textContent = data.metrics.total_cursistas_orientados || 0;
                        totalCursistasEsperados.textContent = data.metrics.total_cursistas_esperados || 0;
                    }

                } else if (tableId === 'ateste') {
                    const numFormacoesUnicas = metricsContainer.querySelector(`#ateste-num_formacoes_unicas`);
                    if (numFormacoesUnicas) numFormacoesUnicas.textContent = data.metrics.num_formacoes_unicas || 0;

                    const totalAPagar = metricsContainer.querySelector(`#ateste-total_a_pagar`);
                    if (totalAPagar) totalAPagar.textContent = data.metrics.total_a_pagar || "0,00";
                } else if (tableId === 'ocorrencias') {
                    const numOcorrencias = metricsContainer.querySelector(`#ocorrencias-num_ocorrencias`);
                    if (numOcorrencias) numOcorrencias.textContent = data.metrics.num_ocorrencias || 0;
                    const ocorrenciasAtivas = metricsContainer.querySelector(`#ocorrencias-ocorrencias_ativas`);
                    if (ocorrenciasAtivas) ocorrenciasAtivas.textContent = data.metrics.ocorrencias_ativas || 0;
                }
            }
        } catch (error) {
            console.error(`ERRO JS: Erro ao carregar resultados para ${tableId}:`, error);
            if (resultsTableBody) {
                resultsTableBody.innerHTML = `<tr><td colspan="100%">Erro ao carregar dados. Por favor, tente novamente.</td></tr>`;
            }
        }
    }

    window.openEditModal = async function(recordIdentifier, tableId) {
        currentRecordId = recordIdentifier;
        currentTableId = tableId;
    
        editModal.style.display = "block";
        document.body.style.overflow = 'hidden';
        editModalContent.innerHTML = 'Carregando...';
    
        try {
            const url = tableId === 'participantes_base_editavel' || tableId === 'usuarios' ? `/api/records/${tableId}/${recordIdentifier}` : `/api/records/${tableId}/${recordIdentifier}`;
            const record = await fetchData(url);
            
            if (!record) {
                editModalContent.innerHTML = `<p style="color:red;">Registro não encontrado.</p>`;
                return;
            }
            
            const template = editModalHtmlTemplates[tableId];
            if (template) {
                editModalContent.innerHTML = template(record);
            } else {
                editModalContent.innerHTML = `<p style="color:red;">Não há um formulário de edição para a tabela: ${tableId}.</p>`;
            }
    
            const editForm = document.getElementById('editForm');
            if (editForm) {
                editForm.addEventListener('submit', async function(event) {
                    event.preventDefault();
                    
                    const formData = new FormData(editForm);
                    const data = Object.fromEntries(formData.entries());
                    const endpoint = `/edit/record/${tableId}`;
                    
                    try {
                        const res = await submitFormData(endpoint, data);
                        alert(res.message);
                        if (res.success) {
                            window.closeModal();
                            if (tableId === 'visitas') {
                                fetchVisitas();
                            } else {
                                fetchResults(tableId, currentPage[tableId] || 1);
                            }
                        }
                    } catch (error) {
                        console.error('ERRO JS: Erro ao salvar edição:', error);
                    }
                });
            }
        } catch (error) {
            editModalContent.innerHTML = `<p style="color:red;">${error.message}</p>`;
            console.error('ERRO JS:', error);
        }
    };
    
    window.handleDeleteRecord = async function(recordId, table, turma = null, data_formacao = null, pauta = null) {
        let confirmed = false;
        let deleteRelated = false;
    
        if (table === 'presenca' && turma && data_formacao && pauta) {
            const options = ['Excluir apenas este registro.', 'Excluir todos os registros da mesma formação (turma, data e pauta).'];
            const choice = prompt(`O registro de presença faz parte de uma formação. O que você deseja fazer?\n1. ${options[0]}\n2. ${options[1]}`);
    
            if (choice === '1') {
                confirmed = confirm(`Tem certeza que deseja excluir APENAS o registro ID ${recordId} da tabela "${table}"? Esta ação é irreversível!`);
                deleteRelated = false;
            } else if (choice === '2') {
                confirmed = confirm(`Tem certeza que deseja excluir TODOS os registros da turma "${turma}" da pauta ${pauta} na data ${data_formacao}? Esta ação é irreversível!`);
                deleteRelated = true;
            }
        } else {
            confirmed = confirm(`Tem certeza que deseja excluir o registro ID ${recordId} da tabela "${table}"? Esta ação é irreversível!`);
        }
    
        if (confirmed) {
            try {
                const response = await fetch('/api/delete/entry', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: recordId,
                        table: table,
                        delete_related: deleteRelated,
                        turma: turma,
                        data_formacao: data_formacao,
                        pauta: pauta
                    })
                });
    
                const result = await response.json();
                if (result.success) {
                    alert(result.message);
                    if (table === 'visitas') {
                        fetchVisitas();
                    } else {
                        fetchResults(table, currentPage[table] || 1);
                    }
                } else {
                    alert(`Erro: ${result.message}`);
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao excluir registro:', error);
                alert('Ocorreu um erro ao tentar excluir o registro.');
            }
        }
    };

    function handleFormSubmit(formId, endpoint, successMessage) {
        const form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener('submit', async function(event) {
            event.preventDefault();
            console.log(`DEBUG JS: Submetendo formulário '${formId}' para o endpoint '${endpoint}'.`);

            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());

            if (formId === 'formPresenca') {
                const participantesData = {};
                this.querySelectorAll('.participante-item').forEach(item => {
                    const cpf = item.querySelector('input[name^="cpf_"]').value;
                    if (cpf) {
                        participantesData[cpf] = {
                            nome: item.querySelector(`input[name="participante_${cpf}"]`).value,
                            cpf: cpf,
                            escola: item.querySelector(`input[name="escola_${cpf}"]`).value,
                            diretoria_de_ensino: item.querySelector(`input[name="de_${cpf}"]`).value,
                            presenca: item.querySelector(`input[name="presenca_${cpf}"]:checked`)?.value || '',
                            camera: item.querySelector(`input[name="camera_${cpf}"]:checked`)?.value || '',
                            di: item.querySelector(`input[name="di_${cpf}"]`)?.value || '',
                            pei: item.querySelector(`input[name="pei_${cpf}"]`)?.value || '',
                            declinou: item.querySelector(`input[name="declinou_${cpf}"]`)?.value || '',
                        };
                    }
                });
                data.participantes = participantesData;

                if (data.substituicao_ocorreu === 'Não') {
                    delete data.nome_substituto;
                }
            } else if (formId === 'formAcompanhamento') {
                const encontroRealizado = data['encontro_realizado'];
                if (encontroRealizado === 'Não') {
                    delete data['formador_presente'];
                    delete data['formador_camera'];
                    delete data['formador_fundo'];
                    delete data['dia_semana_encontro'];
                    delete data['horario_encontro'];
                    delete data['real_participantes'];
                    delete data['camera_aberta_participantes'];
                }
            } else if (formId === 'formDemandas') {
                data.pm_orientados = document.getElementById('pm_orientados_demandas').value;
                data.cursistas_orientados = document.getElementById('cursistas_orientados_demandas').value;

                const selectedValue = this.querySelector('input[name="visitas_escolas_demandas"]:checked')?.value;
                if (selectedValue === 'Sim') {
                    const selectedSchools = Array.from(document.querySelectorAll('#escolas-checkbox-container input[type="checkbox"]:checked')).map(checkbox => checkbox.value);
                    data.escolas_visitadas = selectedSchools;
                } else {
                    data.escolas_visitadas = [];
                }
                
                const engagementCheckboxes = this.querySelectorAll('input[name="engajamento_demandas"]:checked');
                data.engajamento = Array.from(engagementCheckboxes).map(cb => cb.value);

                const outraAcaoInput = this.querySelector('input[name="outra_acao_demandas"]');
                if (outraAcaoInput && data.engajamento.includes('Outra')) {
                    data.engajamento = data.engajamento.filter(item => item !== 'Outra');
                    if (outraAcaoInput.value.trim() !== '') {
                        data.engajamento.push(`Outra: ${outraAcaoInput.value.trim()}`);
                    }
                }
            } else if (formId === 'formOcorrencia') {
                if (data.tipo_ocorrencia !== 'Outra') {
                    delete data.outra_ocorrencia_desc;
                }
            }

            try {
                const result = await submitFormData(endpoint, data);
                if (result.success) {
                    alert(successMessage);
                    form.reset();
                    if (formId === 'formDemandas') {
                        document.getElementById('escolas-container').style.display = 'none';
                        document.getElementById('pm_orientados_esperado_demandas').value = '';
                        document.getElementById('cursistas_orientados_esperado_demandas').value = '';
                    } else if (formId === 'formPresenca') {
                        document.getElementById('substituto-presenca-container').style.display = 'none';
                        document.getElementById('nome_substituto_presenca').value = '';
                    } else if (formId === 'formAcompanhamento') {
                        document.getElementById('encontro-realizado-sim').style.display = 'none';
                        document.getElementById('encontro-realizado-nao').style.display = 'none';
                    } else if (formId === 'formOcorrencia') {
                        document.getElementById('outra_ocorrencia_desc_container').style.display = 'none';
                    }
                    
                    loadAllDatalists();
                    const activeTabButton = document.querySelector('.tab-button.active');
                    if (activeTabButton) {
                        const sectionId = activeTabButton.dataset.sectionId;
                        const tableId = activeTabButton.dataset.tableId;
                        window.showSection(sectionId, tableId);
                    }
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao enviar formulário:', error);
            }
        });
    }

    window.showSection = function(sectionId, tableId = null) {
        console.log(`DEBUG JS: Chamada showSection. Exibindo seção: ${sectionId}, Tabela: ${tableId}`);
        document.querySelectorAll('.section').forEach(section => {
            section.style.display = 'none';
        });
        const activeSection = document.getElementById(sectionId);
        if (activeSection) {
            activeSection.style.display = 'block';
        }

        document.querySelectorAll('.tab-button').forEach(button => {
            button.classList.remove('active');
        });
        const clickedButton = document.querySelector(`.tab-button[data-section-id="${sectionId}"]`);
        if (clickedButton) {
            clickedButton.classList.add('active');
        }

        if (sectionId === 'links-importantes') {
            loadLinksPage();
        } else if (sectionId === 'visitas-encontros') {
            fetchVisitas();
        } else if (tableId) {
            currentPage[tableId] = 1;
            fetchResults(tableId, 1);
        }
    };

    async function loadLinksPage() {
        const linksContainer = document.getElementById('links-container');
        try {
            const links = await fetchData('/get_links');
            linksContainer.innerHTML = '';
            if (links.length > 0) {
                links.forEach(link => {
                    const linkCard = document.createElement('div');
                    linkCard.classList.add('link-card');
                    linkCard.innerHTML = `
                        <div class="link-info">
                            <h3><a href="${link.url}" target="_blank">${link.titulo}</a></h3>
                            <p>${link.descricao}</p>
                        </div>
                        <div class="link-image-container">
                            <img src="${link.imagem_url}" alt="${link.titulo}" class="link-image">
                        </div>
                    `;
                    linksContainer.appendChild(linkCard);
                });
            } else {
                linksContainer.innerHTML = '<p>Nenhum link importante cadastrado no momento.</p>';
            }
        } catch (error) {
            console.error('ERRO JS: Erro ao carregar links:', error);
            linksContainer.innerHTML = '<p>Ocorreu um erro ao carregar os links.</p>';
        }
    }
    
    async function loadLinksAdmin() {
        const linksAdminListBody = document.querySelector('#links-admin-list tbody');
        try {
            const links = await fetchData('/admin/links');
            linksAdminListBody.innerHTML = '';
            links.forEach(link => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${link.titulo}</td>
                    <td><a href="${link.url}" target="_blank">${link.url}</a></td>
                    <td>
                        <button class="edit-link-button" data-id="${link.id}">Editar</button>
                        <button class="delete-link-button red-button" data-id="${link.id}">Excluir</button>
                    </td>
                `;
                linksAdminListBody.appendChild(tr);
            });
        } catch (error) {
            console.error('ERRO JS: Erro ao carregar links:', error);
            linksAdminListBody.innerHTML = '<tr><td colspan="3">Erro ao carregar links.</td></tr>';
        }
    }

    async function fetchAvisoDataForAdmin() {
        const avisoForm = document.getElementById('avisoForm');
        const avisoFormH3 = avisoForm.querySelector('h3');
        try {
            const aviso = await fetchData('/admin/avisos');
            document.getElementById('aviso-titulo').value = aviso.titulo;
            document.getElementById('aviso-conteudo').value = aviso.conteudo;
            document.getElementById('aviso-imagem-url').value = aviso.imagem_url;
            if (avisoFormH3) {
                avisoFormH3.textContent = 'Editar Aviso Existente';
            }
        } catch (error) {
            if (error.message.includes('404')) {
                if (avisoFormH3) {
                    avisoFormH3.textContent = 'Criar Novo Aviso';
                }
            }
            console.warn('DEBUG JS: Erro ao carregar aviso para o admin (provavelmente não há aviso cadastrado):', error);
        }
    }
    
    async function fetchAviso() {
        const avisoModal = document.getElementById('aviso-modal');
        try {
            const aviso = await fetchData('/admin/avisos');
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
        } catch (error) {
            avisoModal.style.display = 'none';
            console.warn('DEBUG JS: Aviso não encontrado ou erro ao carregar:', error);
        }
    }
    
    async function loadSchoolsByDiretoria() {
        const diretoriaDemandasInput = document.getElementById('diretoria_demandas');
        const escolasCheckboxContainer = document.getElementById('escolas-checkbox-container');
        const diretoria = diretoriaDemandasInput.value;
        console.log(`DEBUG JS: Carregando escolas para a diretoria: ${diretoria}`);
        if (diretoria && escolasCheckboxContainer) {
            try {
                const schools = await fetchData(`/api/datalists/schools_by_de?diretoria=${encodeURIComponent(diretoria)}`);
                escolasCheckboxContainer.innerHTML = '';
                schools.forEach(school => {
                    const label = document.createElement('label');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.name = 'escolas_visitadas_demandas';
                    checkbox.value = school;
                    checkbox.addEventListener('change', countParticipants);
                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode(school));
                    escolasCheckboxContainer.appendChild(label);
                });
                console.log(`DEBUG JS: Escolas carregadas para '${diretoria}': ${schools.length}.`);
                countParticipants();
            } catch (error) {
                console.error('ERRO JS: Erro ao carregar escolas por diretoria:', error);
                escolasCheckboxContainer.innerHTML = '';
            }
        } else if (escolasCheckboxContainer) {
            escolasCheckboxContainer.innerHTML = '';
        }
    };
    
    const editModalHtmlTemplates = {
        'presenca': (record) => `
            <h3>Editar Registro de Presença</h3>
            <form id="editForm">
                <input type="hidden" name="id" value="${record.id}">
                <p><strong>Participante:</strong> ${record.nome_participante}</p>
                <p><strong>Turma:</strong> ${record.turma}</p>
                <p><strong>Data:</strong> ${new Date(record.data_formacao).toLocaleDateString('pt-BR')}</p>
                <label>Presença:</label>
                <div class="radio-group">
                    <label><input type="radio" name="presenca" value="SIM" ${record.presenca === 'SIM' ? 'checked' : ''}> SIM</label>
                    <label><input type="radio" name="presenca" value="NÃO" ${record.presenca === 'NÃO' ? 'checked' : ''}> NÃO</label>
                </div>
                <label>Câmera:</label>
                <div class="radio-group">
                    <label><input type="radio" name="camera" value="SIM" ${record.camera === 'SIM' ? 'checked' : ''}> SIM</label>
                    <label><input type="radio" name="camera" value="NÃO" ${record.camera === 'NÃO' ? 'checked' : ''}> NÃO</label>
                </div>
                <div class="button-group">
                    <button type="submit" class="modal-save-button">Salvar</button>
                    <button type="button" class="modal-close-button close-button" onclick="closeModal()">Cancelar</button>
                </div>
            </form>
        `,
        'acompanhamento': (record) => `
            <h3>Editar Registro de Acompanhamento</h3>
            <form id="editForm">
                <input type="hidden" name="id" value="${record.id}">
                <p><strong>Responsável:</strong> ${record.responsavel_acompanhamento}</p>
                <p><strong>Formador:</strong> ${record.formador_assistido}</p>
                <p><strong>Turma:</strong> ${record.turma}</p>
                <p><strong>Data:</strong> ${new Date(record.data_encontro).toLocaleDateString('pt-BR')}</p>
                <label>Encontro Realizado:</label>
                <div class="radio-group">
                    <label><input type="radio" name="encontro_realizado" value="Sim" ${record.encontro_realizado === 'Sim' ? 'checked' : ''}> Sim</label>
                    <label><input type="radio" name="encontro_realizado" value="Não" ${record.encontro_realizado === 'Não' ? 'checked' : ''}> Não</label>
                </div>
                <div id="modal-encontro-realizado-sim" class="form-section" style="${record.encontro_realizado === 'Sim' ? 'display:block;' : 'display:none;'}">
                    <label>Formador estava presente?</label>
                    <div class="radio-group">
                        <label><input type="radio" name="formador_presente" value="Sim" ${record.formador_presente === 'Sim' ? 'checked' : ''}> Sim</label>
                        <label><input type="radio" name="formador_presente" value="Não" ${record.formador_presente === 'Não' ? 'checked' : ''}> Não</label>
                    </div>
                    <label>Câmera do formador aberta?</label>
                    <div class="radio-group">
                        <label><input type="radio" name="formador_camera" value="Sim" ${record.formador_camera === 'Sim' ? 'checked' : ''}> SIM</label>
                        <label><input type="radio" name="formador_camera" value="NÃO" ${record.formador_camera === 'NÃO' ? 'checked' : ''}> NÃO</label>
                    </div>
                    <label>Fundo de tela do Multiplica?</label>
                    <div class="radio-group">
                        <label><input type="radio" name="formador_fundo" value="Sim" ${record.formador_fundo === 'Sim' ? 'checked' : ''}> Sim</label>
                        <label><input type="radio" name="formador_fundo" value="Não" ${record.formador_fundo === 'Não' ? 'checked' : ''}> Não</label>
                    </div>
                    <label for="dia_semana_encontro">Dia da semana:</label>
                    <input type="text" name="dia_semana_encontro" value="${record.dia_semana_encontro || ''}">
                    <label for="horario_encontro">Horário:</label>
                    <input type="text" name="horario_encontro" value="${record.horario_encontro || ''}">
                    <label for="real_participantes">Participantes reais:</label>
                    <input type="number" name="real_participantes" value="${record.real_participantes || 0}">
                    <label for="camera_aberta_participantes">Câmera aberta:</label>
                    <input type="number" name="camera_aberta_participantes" value="${record.camera_aberta_participantes || 0}">
                </div>
                <div id="modal-encontro-realizado-nao" class="form-section" style="${record.encontro_realizado === 'Não' ? 'display:block;' : 'display:none;'}">
                    <label for="motivo_nao_ocorrencia">Motivo da não ocorrência:</label>
                    <textarea name="motivo_nao_ocorrencia">${record.motivo_nao_ocorrencia || ''}</textarea>
                </div>
                <label for="observacao">Observação:</label>
                <textarea name="observacao">${record.observacao || ''}</textarea>
                <div class="button-group">
                    <button type="submit" class="modal-save-button">Salvar</button>
                    <button type="button" class="modal-close-button close-button" onclick="closeModal()">Cancelar</button>
                </div>
            </form>
        `,
        'avaliacao': (record) => `
            <h3>Editar Registro de Avaliação</h3>
            <form id="editForm">
                <input type="hidden" name="id" value="${record.id}">
                <p><strong>Observado:</strong> ${record.observado}</p>
                <p><strong>Turma:</strong> ${record.codigo_turma}</p>
                <p><strong>Data:</strong> ${new Date(record.data_acompanhamento).toLocaleDateString('pt-BR')}</p>
                <label for="nota_final">Nota Final:</label>
                <input type="number" name="nota_final" value="${record.nota_final || 0}" step="0.01">
                <label for="feedback_estruturado">Feedback Estruturado:</label>
                <textarea name="feedback_estruturado" rows="4">${record.feedback_estruturado || ''}</textarea>
                <label for="observacoes_gerais">Observações Gerais:</label>
                <textarea name="observacoes_gerais" rows="4">${record.observacoes_gerais || ''}</textarea>
                <div class="button-group">
                    <button type="submit" class="modal-save-button">Salvar</button>
                    <button type="button" class="modal-close-button close-button" onclick="closeModal()">Cancelar</button>
                </div>
            </form>
        `,
        'demandas': (record) => `
            <h3>Editar Registro de Demanda</h3>
            <form id="editForm">
                <input type="hidden" name="id" value="${record.id}">
                <p><strong>PEC:</strong> ${record.pec}</p>
                <p><strong>Semana:</strong> ${record.semana}</p>
                <p><strong>Diretoria:</strong> ${record.diretoria_de_ensino}</p>
                <label for="formacoes_realizadas">Formações realizadas:</label>
                <input type="number" name="formacoes_realizadas" value="${record.formacoes_realizadas || 0}">
                <label for="pm_orientados">PMs Orientados:</label>
                <input type="number" name="pm_orientados" value="${record.pm_orientados || 0}">
                <label for="cursistas_orientados">Cursistas Orientados:</label>
                <input type="number" name="cursistas_orientados" value="${record.cursistas_orientados || 0}">
                <div class="button-group">
                    <button type="submit" class="modal-save-button">Salvar</button>
                    <button type="button" class="modal-close-button close-button" onclick="closeModal()">Cancelar</button>
                </div>
            </form>
        `,
        'ateste': (record) => `
            <h3>Editar Registro de Ateste</h3>
            <form id="editForm">
                <input type="hidden" name="id" value="${record.id}">
                <p><strong>Nome:</strong> ${record.nome_quem_preencheu}</p>
                <p><strong>Turma:</strong> ${record.turma}</p>
                <p><strong>Data:</strong> ${new Date(record.data_formacao).toLocaleDateString('pt-BR')}</p>
                <label for="valor_formacao">Valor da Formação:</label>
                <input type="number" name="valor_formacao" value="${record.valor_formacao || 0}" step="0.01">
                <div class="button-group">
                    <button type="submit" class="modal-save-button">Salvar</button>
                    <button type="button" class="modal-close-button close-button" onclick="closeModal()">Cancelar</button>
                </div>
            </form>
        `,
        'ocorrencias': (record) => `
            <h3>Editar Registro de Ocorrência</h3>
            <form id="editForm">
                <input type="hidden" name="id" value="${record.id}">
                <p><strong>Relator:</strong> ${record.nome}</p>
                <p><strong>Turma:</strong> ${record.turma}</p>
                <p><strong>Data/Hora:</strong> ${new Date(record.data_horario).toLocaleDateString()} ${new Date(record.data_horario).toLocaleTimeString()}</p>
                <label for="tipo_ocorrencia">Tipo de Ocorrência:</label>
                <input type="text" name="tipo_ocorrencia" value="${record.tipo_ocorrencia || ''}">
                <label for="outra_ocorrencia_desc">Descrição do Outro Tipo:</label>
                <textarea name="outra_ocorrencia_desc" rows="2">${record.outra_ocorrencia_desc || ''}</textarea>
                <label for="descricao_problema">Descrição do Problema:</label>
                <textarea name="descricao_problema" rows="4">${record.descricao_problema || ''}</textarea>
                <label for="ocorrencia_ainda_ocorre">Ocorrência ainda ocorre?</label>
                <div class="radio-group">
                    <label><input type="radio" name="ocorrencia_ainda_ocorre" value="Sim" ${record.ocorrencia_ainda_ocorre === 'Sim' ? 'checked' : ''}> Sim</label>
                    <label><input type="radio" name="ocorrencia_ainda_ocorre" value="Não" ${record.ocorrencia_ainda_ocorre === 'Não' ? 'checked' : ''}> Não</label>
                </div>
                <div class="button-group">
                    <button type="submit" class="modal-save-button">Salvar</button>
                    <button type="button" class="modal-close-button close-button" onclick="closeModal()">Cancelar</button>
                </div>
            </form>
        `,
        'visitas': (record) => `
            <h3>Editar Registro de Visitação</h3>
            <form id="editForm">
                <input type="hidden" name="id" value="${record.id}">
                <p><strong>Responsável:</strong> ${record.responsavel_visitacao}</p>
                <p><strong>Turma:</strong> ${record.turma}</p>
                <p><strong>Data:</strong> ${new Date(record.data_formacao).toLocaleDateString('pt-BR')}</p>
                <p><strong>Horário:</strong> ${record.horario}</p>

                <label for="encontro_aconteceu">Encontro Aconteceu?:</label>
                <div class="radio-group">
                    <label><input type="radio" name="encontro_aconteceu" value="Sim" ${record.encontro_aconteceu === 'Sim' ? 'checked' : ''}> Sim</label>
                    <label><input type="radio" name="encontro_aconteceu" value="Não" ${record.encontro_aconteceu === 'Não' ? 'checked' : ''}> Não</label>
                </div>

                <label for="motivo_nao_aconteceu">Motivo (se não aconteceu):</label>
                <textarea name="motivo_nao_aconteceu">${record.motivo_nao_aconteceu || ''}</textarea>

                <label for="observacao_visita">Observação:</label>
                <textarea name="observacao_visita" rows="4">${record.observacao || ''}</textarea>

                <div class="button-group">
                    <button type="submit" class="modal-save-button">Salvar</button>
                    <button type="button" class="modal-close-button close-button" onclick="closeModal()">Cancelar</button>
                </div>
            </form>
        `,
        'usuarios': (record) => `
            <h3>Editar Usuário</h3>
            <form id="editForm">
                <input type="hidden" name="cpf" value="${record.cpf}">
                <p><strong>CPF:</strong> ${record.cpf}</p>
                <label for="access_level">Nível de Acesso:</label>
                <select id="access_level" name="access_level" required>
                    <option value="no_access" ${record.access_level === 'no_access' ? 'selected' : ''}>Sem Acesso</option>
                    <option value="basic_access" ${record.access_level === 'basic_access' ? 'selected' : ''}>Basic Access (PM/PC)</option>
                    <option value="formador_access" ${record.access_level === 'formador_access' ? 'selected' : ''}>Formador Access (FORMADOR)</option>
                    <option value="efape_access" ${record.access_level === 'efape_access' ? 'selected' : ''}>EFAPE Access (EFAPE)</option>
                    <option value="intermediate_access" ${record.access_level === 'intermediate_access' ? 'selected' : ''}>Intermediate Access (PEC)</option>
                    <option value="super_admin" ${record.access_level === 'super_admin' ? 'selected' : ''}>Super Admin (ADM)</option>
                </select>
                <div class="button-group">
                    <button type="submit" class="modal-save-button">Salvar</button>
                    <button type="button" class="modal-close-button close-button" onclick="closeModal()">Cancelar</button>
                </div>
            </form>
        `
    };

    window.openEditModal = async function(recordIdentifier, tableId) {
        currentRecordId = recordIdentifier;
        currentTableId = tableId;
    
        editModal.style.display = "block";
        document.body.style.overflow = 'hidden';
        editModalContent.innerHTML = 'Carregando...';
    
        try {
            const url = tableId === 'participantes_base_editavel' || tableId === 'usuarios' ? `/api/records/${tableId}/${recordIdentifier}` : `/api/records/${tableId}/${recordIdentifier}`;
            const record = await fetchData(url);
            
            if (!record) {
                editModalContent.innerHTML = `<p style="color:red;">Registro não encontrado.</p>`;
                return;
            }
            
            const template = editModalHtmlTemplates[tableId];
            if (template) {
                editModalContent.innerHTML = template(record);
            } else {
                editModalContent.innerHTML = `<p style="color:red;">Não há um formulário de edição para a tabela: ${tableId}.</p>`;
            }
    
            const editForm = document.getElementById('editForm');
            if (editForm) {
                editForm.addEventListener('submit', async function(event) {
                    event.preventDefault();
                    
                    const formData = new FormData(editForm);
                    const data = Object.fromEntries(formData.entries());
                    const endpoint = `/edit/record/${tableId}`;
                    
                    try {
                        const res = await submitFormData(endpoint, data);
                        alert(res.message);
                        if (res.success) {
                            window.closeModal();
                            if (tableId === 'visitas') {
                                fetchVisitas();
                            } else {
                                fetchResults(tableId, currentPage[tableId] || 1);
                            }
                        }
                    } catch (error) {
                        console.error('ERRO JS: Erro ao salvar edição:', error);
                    }
                });
            }
        } catch (error) {
            editModalContent.innerHTML = `<p style="color:red;">${error.message}</p>`;
            console.error('ERRO JS:', error);
        }
    };
    
    window.handleDeleteRecord = async function(recordId, table, turma = null, data_formacao = null, pauta = null) {
        let confirmed = false;
        let deleteRelated = false;
    
        if (table === 'presenca' && turma && data_formacao && pauta) {
            const options = ['Excluir apenas este registro.', 'Excluir todos os registros da mesma formação (turma, data e pauta).'];
            const choice = prompt(`O registro de presença faz parte de uma formação. O que você deseja fazer?\n1. ${options[0]}\n2. ${options[1]}`);
    
            if (choice === '1') {
                confirmed = confirm(`Tem certeza que deseja excluir APENAS o registro ID ${recordId} da tabela "${table}"? Esta ação é irreversível!`);
                deleteRelated = false;
            } else if (choice === '2') {
                confirmed = confirm(`Tem certeza que deseja excluir TODOS os registros da turma "${turma}" da pauta ${pauta} na data ${data_formacao}? Esta ação é irreversível!`);
                deleteRelated = true;
            }
        } else {
            confirmed = confirm(`Tem certeza que deseja excluir o registro ID ${recordId} da tabela "${table}"? Esta ação é irreversível!`);
        }
    
        if (confirmed) {
            try {
                const response = await fetch('/api/delete/entry', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: recordId,
                        table: table,
                        delete_related: deleteRelated,
                        turma: turma,
                        data_formacao: data_formacao,
                        pauta: pauta
                    })
                });
    
                const result = await response.json();
                if (result.success) {
                    alert(result.message);
                    if (table === 'visitas') {
                        fetchVisitas();
                    } else {
                        fetchResults(table, currentPage[table] || 1);
                    }
                } else {
                    alert(`Erro: ${result.message}`);
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao excluir registro:', error);
                alert('Ocorreu um erro ao tentar excluir o registro.');
            }
        }
    };

    function handleFormSubmit(formId, endpoint, successMessage) {
        const form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener('submit', async function(event) {
            event.preventDefault();
            console.log(`DEBUG JS: Submetendo formulário '${formId}' para o endpoint '${endpoint}'.`);

            const formData = new FormData(this);
            const data = Object.fromEntries(formData.entries());

            if (formId === 'formPresenca') {
                const participantesData = {};
                this.querySelectorAll('.participante-item').forEach(item => {
                    const cpf = item.dataset.cpf;
                    if (cpf) {
                        participantesData[cpf] = {
                            nome: item.querySelector(`input[name="participante_${cpf}"]`).value,
                            cpf: cpf,
                            escola: item.querySelector(`input[name="escola_${cpf}"]`).value,
                            diretoria_de_ensino: item.querySelector(`input[name="de_${cpf}"]`).value,
                            presenca: item.querySelector(`input[name="presenca_${cpf}"]:checked`)?.value || '',
                            camera: item.querySelector(`input[name="camera_${cpf}"]:checked`)?.value || '',
                            di: item.querySelector(`input[name="di_${cpf}"]`)?.value || '',
                            pei: item.querySelector(`input[name="pei_${cpf}"]`)?.value || '',
                            declinou: item.querySelector(`input[name="declinou_${cpf}"]`)?.value || '',
                        };
                    }
                });
                data.participantes = participantesData;

                if (data.substituicao_ocorreu === 'Não') {
                    delete data.nome_substituto;
                }
            } else if (formId === 'formAcompanhamento') {
                const encontroRealizado = data['encontro_realizado'];
                if (encontroRealizado === 'Não') {
                    delete data['formador_presente'];
                    delete data['formador_camera'];
                    delete data['formador_fundo'];
                    delete data['dia_semana_encontro'];
                    delete data['horario_encontro'];
                    delete data['real_participantes'];
                    delete data['camera_aberta_participantes'];
                }
            } else if (formId === 'formDemandas') {
                data.pm_orientados = document.getElementById('pm_orientados_demandas').value;
                data.cursistas_orientados = document.getElementById('cursistas_orientados_demandas').value;

                const selectedValue = this.querySelector('input[name="visitas_escolas_demandas"]:checked')?.value;
                if (selectedValue === 'Sim') {
                    const selectedSchools = Array.from(document.querySelectorAll('#escolas-checkbox-container input[type="checkbox"]:checked')).map(checkbox => checkbox.value);
                    data.escolas_visitadas = selectedSchools;
                } else {
                    data.escolas_visitadas = [];
                }
                
                const engagementCheckboxes = this.querySelectorAll('input[name="engajamento_demandas"]:checked');
                data.engajamento = Array.from(engagementCheckboxes).map(cb => cb.value);

                const outraAcaoInput = this.querySelector('input[name="outra_acao_demandas"]');
                if (outraAcaoInput && data.engajamento.includes('Outra')) {
                    data.engajamento = data.engajamento.filter(item => item !== 'Outra');
                    if (outraAcaoInput.value.trim() !== '') {
                        data.engajamento.push(`Outra: ${outraAcaoInput.value.trim()}`);
                    }
                }
            } else if (formId === 'formOcorrencia') {
                if (data.tipo_ocorrencia !== 'Outra') {
                    delete data.outra_ocorrencia_desc;
                }
            }

            try {
                const result = await submitFormData(endpoint, data);
                if (result.success) {
                    alert(successMessage);
                    form.reset();
                    if (formId === 'formDemandas') {
                        document.getElementById('escolas-container').style.display = 'none';
                        document.getElementById('pm_orientados_esperado_demandas').value = '';
                        document.getElementById('cursistas_orientados_esperado_demandas').value = '';
                    } else if (formId === 'formPresenca') {
                        document.getElementById('substituto-presenca-container').style.display = 'none';
                        document.getElementById('nome_substituto_presenca').value = '';
                    } else if (formId === 'formAcompanhamento') {
                        document.getElementById('encontro-realizado-sim').style.display = 'none';
                        document.getElementById('encontro-realizado-nao').style.display = 'none';
                    } else if (formId === 'formOcorrencia') {
                        document.getElementById('outra_ocorrencia_desc_container').style.display = 'none';
                    }
                    
                    loadAllDatalists();
                    const activeTabButton = document.querySelector('.tab-button.active');
                    if (activeTabButton) {
                        const sectionId = activeTabButton.dataset.sectionId;
                        const tableId = activeTabButton.dataset.tableId;
                        window.showSection(sectionId, tableId);
                    }
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao enviar formulário:', error);
            }
        });
    }

    async function checkAccessAndInitializeUI() {
        console.log("DEBUG JS: Iniciando checkAccessAndInitializeUI...");
        try {
            const [visibilityData, accessResponse] = await Promise.all([
                fetchData('/get_visibility').catch(() => ({ hidden_elements: {} })),
                fetch('/get_access_level').catch(() => ({ ok: false }))
            ]);

            let currentAccessLevel = 'none';
            if (accessResponse.ok) {
                const data = await accessResponse.json();
                currentAccessLevel = data.access_level;
            } else {
                window.location.href = '/login';
                return;
            }

            const hiddenElements = visibilityData.hidden_elements || {};

            document.querySelectorAll('.section').forEach(section => section.style.display = 'none');
            document.querySelectorAll('.tab-button').forEach(button => button.style.display = 'none');
            
            const accessMap = {
                'basic_access': ['tab-form-presenca', 'tab-form-ocorrencia', 'tab-resultados-presenca', 'tab-resultados-ocorrencias'],
                'formador_access': ['tab-form-presenca', 'tab-form-acompanhamento', 'tab-form-ocorrencia', 'tab-resultados-presenca', 'tab-resultados-acompanhamento', 'tab-resultados-ocorrencias', 'tab-controle-ateste', 'tab-links-importantes'],
                'efape_access': ['tab-form-presenca', 'tab-form-acompanhamento', 'tab-form-ocorrencia', 'tab-visitas-encontros', 'tab-resultados-presenca', 'tab-resultados-acompanhamento', 'tab-resultados-ocorrencias', 'tab-controle-ateste', 'tab-links-importantes'],
                'intermediate_access': ['tab-form-presenca', 'tab-form-acompanhamento', 'tab-form-avaliacao', 'tab-form-demandas', 'tab-form-ocorrencia', 'tab-resultados-presenca', 'tab-resultados-acompanhamento', 'tab-resultados-avaliacao', 'tab-resultados-demandas', 'tab-resultados-ocorrencias', 'tab-controle-ateste', 'tab-painel-bi', 'tab-links-importantes'],
                'super_admin': ['tab-form-presenca', 'tab-form-acompanhamento', 'tab-form-avaliacao', 'tab-form-demandas', 'tab-form-ocorrencia', 'tab-visitas-encontros', 'tab-resultados-presenca', 'tab-resultados-acompanhamento', 'tab-resultados-avaliacao', 'tab-resultados-demandas', 'tab-resultados-ocorrencias', 'tab-controle-ateste', 'tab-painel-bi', 'tab-links-importantes', 'tab-admin-tools']
            };

            const visibleElements = accessMap[currentAccessLevel] || [];

            document.querySelectorAll('.tab-button').forEach(button => {
                const elementId = button.id;
                const sectionId = button.dataset.sectionId;
                const isHidden = hiddenElements[sectionId] || hiddenElements[elementId];

                if (currentAccessLevel === 'super_admin' || (visibleElements.includes(elementId) && !isHidden)) {
                    button.style.display = 'inline-block';
                }
            });

            const defaultSection = document.getElementById(visibleElements[0])?.dataset.sectionId || 'login';
            window.showSection(defaultSection, document.getElementById(visibleElements[0])?.dataset.tableId);
            
            if (currentAccessLevel === 'super_admin') {
                loadLinksAdmin();
                fetchAvisoDataForAdmin();
                fetchResults('usuarios');
            }

            loadAllDatalists();
            fetchAviso();
            setupLogoutButton();
            setupEventListeners();
            console.log("DEBUG JS: checkAccessAndInitializeUI concluído.");

        } catch (error) {
            console.error('ERRO JS: Erro ao verificar o nível de acesso ou inicializar a UI:', error);
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
            try {
                console.log("DEBUG JS: Tentando fazer logout...");
                await fetch('/logout');
                window.location.href = '/login';
            } catch (error) {
                console.error('ERRO JS: Erro ao fazer logout:', error);
                alert('Erro ao fazer logout.');
            }
        };
        headerContent.appendChild(logoutButton);
    }
    
    function setupEventListeners() {
        const presencaContainer = document.getElementById('participantes-container');
        if (presencaContainer) {
            presencaContainer.addEventListener('change', (e) => {
                const radio = e.target;
                if (radio.name.startsWith('presenca_')) {
                    const isPresent = radio.value === 'SIM';
                    const participanteDiv = radio.closest('.participante-item');
                    handlePresencaRadioChange(participanteDiv, isPresent);
                }
            });
        }
        
        document.querySelectorAll('input[name="encontro_realizado"]').forEach(radio => {
            radio.addEventListener('change', function() {
                const simSection = document.getElementById('encontro-realizado-sim');
                const naoSection = document.getElementById('encontro-realizado-nao');
                const isSim = this.value === 'Sim';
                simSection.style.display = isSim ? 'block' : 'none';
                naoSection.style.display = !isSim ? 'block' : 'none';
                simSection.querySelectorAll('input, select').forEach(el => el.required = isSim);
                naoSection.querySelectorAll('input, select').forEach(el => el.required = !isSim);
            });
        });
        
        document.querySelectorAll('.toggle-form-result').forEach(button => {
            button.addEventListener('click', function() {
                const formId = this.dataset.formId;
                const resultId = this.dataset.resultId;
                const formSection = document.getElementById(formId);
                const resultSection = document.getElementById(resultId);
                const isFormVisible = formSection.style.display === 'block';

                formSection.style.display = isFormVisible ? 'none' : 'block';
                resultSection.style.display = isFormVisible ? 'block' : 'none';

                if (!isFormVisible) {
                    const tableId = resultId.split('-')[1];
                    if (tableId === 'visitas') {
                        fetchVisitas();
                    } else {
                        currentPage[tableId] = 1;
                        fetchResults(tableId, 1);
                    }
                    this.textContent = 'Exibir Formulário';
                } else {
                    this.textContent = 'Ocultar Resultado';
                }
            });
        });

        const responsavelPresencaInput = document.getElementById('responsavel_presenca');
        if(responsavelPresencaInput) {
            responsavelPresencaInput.addEventListener('change', async function() {
                const responsavel = this.value;
                const temaInput = document.getElementById('tema_presenca');
                const turmaInput = document.getElementById('turma_presenca');
                temaInput.value = '';
                turmaInput.value = '';
                document.getElementById('participantes-container').innerHTML = '';
                if (responsavel) {
                    const temas = await fetchData(`/api/datalists/temas_by_responsavel?responsavel=${encodeURIComponent(responsavel)}`);
                    populateDatalist(temas, 'temas-list-presenca');
                } else {
                    loadAllDatalists();
                }
            });
        }

        const temaPresencaInput = document.getElementById('tema_presenca');
        if(temaPresencaInput) {
            temaPresencaInput.addEventListener('change', async function() {
                const tema = this.value;
                const responsavel = document.getElementById('responsavel_presenca').value;
                const turmaInput = document.getElementById('turma_presenca');
                turmaInput.value = '';
                document.getElementById('participantes-container').innerHTML = '';
                if (tema && responsavel) {
                    const turmas = await fetchData(`/api/datalists/turmas_by_tema_and_responsavel?responsavel=${encodeURIComponent(responsavel)}&tema=${encodeURIComponent(tema)}`);
                    populateDatalist(turmas, 'turmas-list');
                } else if (responsavel) {
                    const turmas = await fetchData(`/api/datalists/turmas_by_tema_and_responsavel?responsavel=${encodeURIComponent(responsavel)}`);
                    populateDatalist(turmas, 'turmas-list');
                }
            });
        }

        const turmaPresencaInput = document.getElementById('turma_presenca');
        if(turmaPresencaInput) {
            turmaPresencaInput.addEventListener('change', async function() {
                const turma = this.value;
                const participantesContainer = document.getElementById('participantes-container');
                participantesContainer.innerHTML = '';
                if (turma) {
                    const participantes = await fetchData(`/api/info/participantes_by_turma?turma=${encodeURIComponent(turma)}`);
                    if (participantes.length > 0) {
                        participantes.forEach(p => {
                            const div = document.createElement('div');
                            div.classList.add('participante-item');
                            div.dataset.cpf = p.cpf;
                            div.innerHTML = `
                                <span class="participante-nome">${p.nome}</span>
                                <span class="participante-info">(${p.diretoria_de_ensino || 'N/A'} - ${p.escola || 'N/A'}) - ${p.etapa || 'N/A'}</span>
                                <div class="radio-group">
                                    <label>Presença:
                                        <input type="radio" name="presenca_${p.cpf}" value="SIM" required> SIM
                                        <input type="radio" name="presenca_${p.cpf}" value="NÃO"> NÃO
                                    </label>
                                    <label>Câmera:
                                        <input type="radio" name="camera_${p.cpf}" value="SIM" required> SIM
                                        <input type="radio" name="camera_${p.cpf}" value="NÃO"> NÃO
                                    </label>
                                </div>
                                <input type="hidden" name="participante_${p.cpf}" value="${p.nome}">
                                <input type="hidden" name="cpf_${p.cpf}" value="${p.cpf}">
                                <input type="hidden" name="escola_${p.cpf}" value="${p.escola}">
                                <input type="hidden" name="de_${p.cpf}" value="${p.diretoria_de_ensino}">
                                <input type="hidden" name="di_${p.cpf}" value="${p.di || ''}">
                                <input type="hidden" name="pei_${p.cpf}" value="${p.pei || ''}">
                                <input type="hidden" name="declinou_${p.cpf}" value="${p.declinou || ''}">
                            `;
                            participantesContainer.appendChild(div);
                        });
                    } else {
                        participantesContainer.innerHTML = '<p>Nenhum participante encontrado para esta turma.</p>';
                    }
                }
            });
        }
        
        const manageUserForm = document.getElementById('manageUserForm');
        const searchCpfInput = document.getElementById('search-cpf');
        const userDetailsForm = document.getElementById('user-details-form');
        const formCpfInput = document.getElementById('user-cpf');
        const formAccessLevel = document.getElementById('user-access-level');
        const deleteUserButton = document.getElementById('delete-user-button');
        const saveUserButton = document.getElementById('save-user-button');
        const newUserButton = document.getElementById('new-user-button');

        const resetUserForm = () => {
            searchCpfInput.value = '';
            userDetailsForm.style.display = 'none';
            formCpfInput.value = '';
            formAccessLevel.value = 'no_access';
            formCpfInput.readOnly = false;
            deleteUserButton.style.display = 'none';
            saveUserButton.textContent = 'Adicionar Novo Usuário';
        };

        document.getElementById('search-button')?.addEventListener('click', async () => {
            const cpf = searchCpfInput.value.trim();
            if (!cpf) {
                alert('Por favor, insira um CPF para pesquisar.');
                return;
            }
            try {
                const response = await fetch(`/admin/search_user?cpf=${encodeURIComponent(cpf)}`);
                const data = await response.json();
                if (data.usuario) {
                    formCpfInput.value = data.usuario.cpf;
                    formAccessLevel.value = data.usuario.access_level;
                    formCpfInput.readOnly = true;
                    deleteUserButton.style.display = 'block';
                    saveUserButton.textContent = 'Salvar Nível de Acesso';
                    userDetailsForm.style.display = 'block';
                } else {
                    const isConfirmed = confirm("Usuário não encontrado. Deseja adicionar um novo usuário com este CPF?");
                    if (isConfirmed) {
                        resetUserForm();
                        formCpfInput.value = cpf;
                        userDetailsForm.style.display = 'block';
                        saveUserButton.textContent = 'Adicionar Novo Usuário';
                    } else {
                        resetUserForm();
                    }
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao pesquisar usuário:', error);
                alert('Erro ao pesquisar usuário. Verifique a conexão ou tente novamente.');
            }
        });

        manageUserForm?.addEventListener('submit', async (event) => {
            event.preventDefault();
            const cpf = formCpfInput.value.trim();
            const accessLevel = formAccessLevel.value;
            const action = saveUserButton.textContent === 'Adicionar Novo Usuário' ? 'add' : 'edit';
            const data = { action: action, cpf: cpf, access_level: accessLevel };
            if(action === 'add') {
                data.password = '123'; // Senha simbólica para o primeiro acesso
            }

            try {
                const response = await submitFormData('/admin/manage_user', data);
                if (response.success) {
                    resetUserForm();
                    fetchResults('usuarios');
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao salvar usuário:', error);
            }
        });

        deleteUserButton?.addEventListener('click', async () => {
            const cpf = formCpfInput.value;
            if (confirm(`Tem certeza que deseja excluir o usuário com CPF ${cpf}?`)) {
                try {
                    const response = await submitFormData('/admin/manage_user', { action: 'delete', cpf: cpf });
                    if (response.success) {
                        resetUserForm();
                        fetchResults('usuarios');
                    }
                } catch (error) {
                    console.error('ERRO JS: Erro ao excluir usuário:', error);
                }
            }
        });

        newUserButton?.addEventListener('click', resetUserForm);

        handleFormSubmit('formPresenca', '/submit/presenca', 'Registro de presença enviado com sucesso!');
        handleFormSubmit('formAcompanhamento', '/submit/acompanhamento', 'Acompanhamento de encontro salvo com sucesso!');
        handleFormSubmit('formAvaliacao', '/submit/avaliacao', 'Avaliação enviada com sucesso!');
        handleFormSubmit('formDemandas', '/submit/demandas', 'Registro de demanda salvo com sucesso!');
        handleFormSubmit('formOcorrencia', '/submit/ocorrencia', 'Ocorrência registrada com sucesso!');

        const downloadAllReportsButton = document.getElementById('downloadAllReportsButton');
        const downloadStatus = document.getElementById('downloadStatus');

        if (downloadAllReportsButton) {
            downloadAllReportsButton.addEventListener('click', async () => {
                downloadAllReportsButton.disabled = true;
                downloadAllReportsButton.textContent = 'Gerando Relatórios...';
                downloadStatus.textContent = 'A geração do relatório foi iniciada. Aguarde, o download começará em breve.';

                try {
                    const response = await fetch('/admin/download_all_reports_async');
                    const result = await response.json();

                    if (result.success) {
                        const checkStatusInterval = setInterval(async () => {
                            try {
                                const statusResponse = await fetch('/admin/check_download_status');
                                const statusResult = await statusResponse.json();

                                if (statusResult.status === 'ready') {
                                    clearInterval(checkStatusInterval);
                                    downloadStatus.textContent = 'Relatório pronto! O download irá começar...';
                                    window.location.href = `/admin/download_file/${statusResult.filename}`;
                                    
                                    setTimeout(() => {
                                        downloadAllReportsButton.textContent = 'Baixar Todos os Relatórios';
                                        downloadAllReportsButton.disabled = false;
                                        downloadStatus.textContent = '';
                                    }, 3000);

                                } else {
                                    downloadStatus.textContent += '.';
                                }
                            } catch (statusError) {
                                clearInterval(checkStatusInterval);
                                console.error('ERRO JS: Erro ao verificar o status do download:', statusError);
                                downloadStatus.textContent = 'Erro ao verificar o status do download. Tente novamente mais tarde.';
                                downloadAllReportsButton.textContent = 'Baixar Todos os Relatórios';
                                downloadAllReportsButton.disabled = false;
                            }
                        }, 5000);

                    } else {
                        alert('Erro ao iniciar a geração dos relatórios: ' + result.message);
                        downloadStatus.textContent = 'Erro: ' + result.message;
                        downloadAllReportsButton.textContent = 'Baixar Todos os Relatórios';
                        downloadAllReportsButton.disabled = false;
                    }
                } catch (error) {
                    console.error('ERRO JS: Erro ao iniciar a requisição de download:', error);
                    alert('Ocorreu um erro na requisição. Tente novamente.');
                    downloadStatus.textContent = 'Erro ao conectar com o servidor.';
                    downloadAllReportsButton.textContent = 'Baixar Todos os Relatórios';
                    downloadAllReportsButton.disabled = false;
                }
            });
        }
    }

    checkAccessAndInitializeUI();
});