/* eslint-disable no-undef */
/* eslint-disable no-unused-vars */

document.addEventListener('DOMContentLoaded', function() {
    console.log("DEBUG JS: DOM totalmente carregado e pronto para a ação. Usando base_de_dados.xlsx via Flask e JSON para submissões.");

    // Mapeamento das perguntas da avaliação para seus textos completos
    const avaliacaoQuestionsMap = {
        'q1_1': '1.1 - Promove um ambiente virtual seguro, respeitoso e acolhedor, prevenindo condutas inadequadas e incentivando a observância da ética nas interações, em conformidade com as diretrizes do Programa.',
        'q1_2': '1.2 - Conduz a formação em ambiente adequado, utilizando o background do Programa Multiplica SP, bem como condições apropriadas de iluminação, comportamento e execução.',
        'q1_3': '1.3 - Estimula os demais participantes a seguirem as regras de etiqueta, enfatizando a importância dessa prática para a qualidade das formações.',
        'q2_1': '2.1 - Inicia a formação no horário determinado.',
        'q2_2': '2.2 - Gerencia o tempo assegurando a realização das atividades propostas na pauta, priorizando a qualidade das trocas e a participação.',
        'q2_3': '2.3 - Encerra a formação no horário estipulado.',
        'q3_1': '3.1 - Utiliza estratégias e técnicas que favoreçam a participação de todos.',
        'q3_2': '3.2 - Estimulados pelo formador, os participantes contribuem de alguma forma com a formação e demonstram compromisso com as atividades.',
        'q3_3': '3.3 - Gerencia o tempo de forma eficiente, para a participação dos cursistas e dos formadores.',
        'q4_1': '4.1 - Utiliza vocabulário acessível e de fácil compreensão pelos participantes.',
        'q4_2': '4.2 - Faz perguntas disparadoras, coerentes com o conteúdo disposto na Pauta, a fim de melhor conduzir as discussões.',
        'q4_3': '4.3 - As discussões se mantêm produtivas e alinhadas ao objetivo da Pauta, evitando digressões.',
        'q5_1': '5.1 - Demonstra domínio do conteúdo proposto na Pauta, por meio de explicações embasadas nas referências.',
        'q5_2': '5.2 - Promove e estimula exemplos práticos para que conexões com a realidade escolar sejam estabelecidas.',
        'q5_3': '5.3 - Assegura que a formação aconteça numa sequência lógica e progressiva, promovendo a qualidade das etapas do Percurso Formativo.'
    };

    // Variáveis de estado para paginação
    const currentPage = {};
    const totalItems = {};
    const currentFilters = {};
    let allParticipantsCache = [];

    // ====================================================================
    // Funções para buscar dados do Flask (que lê base_de_dados.xlsx e JSONs)
    // ====================================================================

    // Função genérica para popular datalists
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

    // A função loadSpecificDatalists será mesclada em loadAllDatalists para evitar o erro.
    // O código abaixo é a nova implementação otimizada.
    async function loadAllDatalistsOptimized() {
        console.log("DEBUG JS: Carregando todas as datalists de uma vez...");
        try {
            const allDatalistsResponse = await fetch('/get_all_datalists');
            const pecsAndFormadoresResponse = await fetch('/get_pecs_and_formadores');
            const responsaveisForPresencaResponse = await fetch('/get_responsaveis_for_presenca');

            const allDatalistsData = await allDatalistsResponse.json();
            const pecsAndFormadoresData = await pecsAndFormadoresResponse.json();
            const responsaveisForPresencaData = await responsaveisForPresencaResponse.json();

            // Popular datalists gerais
            populateDatalist(allDatalistsData.turmas, 'turmas-list');
            populateDatalist(allDatalistsData.diretorias, 'diretorias-list');
            populateDatalist(allDatalistsData.pecs, 'pecs-list');
            populateDatalist(allDatalistsData.caffs, 'caffs-list');
            populateDatalist(allDatalistsData.pautas_formativas, 'pautas-formativas-list');
            populateDatalist(allDatalistsData.temas, 'temas-list-presenca');
            populateDatalist(allDatalistsData.temas, 'temas-list-ateste');
            populateDatalist(allDatalistsData.responsaveis, 'responsaveis-list-ateste');
            populateDatalist(allDatalistsData.nomes, 'nomes-list-ateste');
            populateDatalist(allDatalistsData.emails, 'emails-list');
            populateDatalist(allDatalistsData.telefones, 'telefones-list');


            // Popular datalists específicas
            populateDatalist(pecsAndFormadoresData, 'observadores-list');
            populateDatalist(responsaveisForPresencaData, 'responsaveis-list');
            populateDatalist(allDatalistsData.nomes, 'nomes-list-avaliacao');
            populateDatalist(allDatalistsData.cpfs, 'cpfs-list');

        } catch (error) {
            console.error('ERRO JS: Erro ao carregar datalists:', error);
        }
    }

    window.populateDatalist = populateDatalist;

    // ====================================================================
    // Lógica de Navegação e Exibição de Seções (ATUALIZADO)
    // ====================================================================

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
        } else if (tableId) {
            currentPage[tableId] = 1;
            fetchResults(tableId, 1);
        }
    };

    // ====================================================================
    // Lógica para o Formulário de Registro de Presença
    // ====================================================================

    const diretoriaPresencaInput = document.getElementById('diretoria_presenca');
    const responsavelPresencaInput = document.getElementById('responsavel_presenca');
    const temaPresencaInput = document.getElementById('tema_presenca');
    const turmaPresencaInput = document.getElementById('turma_presenca');
    const turmaPresencaDatalist = document.getElementById('turmas-list');
    const participantesContainer = document.getElementById('participantes-container');
    const temasPresencaDatalist = document.getElementById('temas-list-presenca');

    // MUDANÇA AQUI: Agora a seleção é feita com botões de rádio
    const substituicaoRadioGroup = document.getElementById('substituicao-ocorreu-radio-group');
    const substitutoPresencaContainer = document.getElementById('substituto-presenca-container');
    const nomeSubstitutoPresencaInput = document.getElementById('nome_substituto_presenca');

    if (substituicaoRadioGroup) {
        substituicaoRadioGroup.addEventListener('change', function(event) {
            const selectedValue = event.target.value;
            if (selectedValue === 'Sim') {
                substitutoPresencaContainer.style.display = 'block';
                nomeSubstitutoPresencaInput.required = true;
            } else {
                substitutoPresencaContainer.style.display = 'none';
                nomeSubstitutoPresencaInput.required = false;
                nomeSubstitutoPresencaInput.value = '';
            }
        });
    }

    if (responsavelPresencaInput) {
        responsavelPresencaInput.addEventListener('change', async function() {
            const responsavel = this.value;
            console.log(`DEBUG JS: Responsável de presença alterado para: ${responsavel}`);
            
            // Mantém o valor do campo de turma se ele já tiver sido preenchido
            const originalTurmaValue = turmaPresencaInput.value;
            temaPresencaInput.value = '';
            if (originalTurmaValue === '') {
                turmaPresencaInput.value = '';
            }
            
            participantesContainer.innerHTML = '';
            if (temasPresencaDatalist) temasPresencaDatalist.innerHTML = '';
            if (turmaPresencaDatalist) turmaPresencaDatalist.innerHTML = '';

            if (responsavel) {
                try {
                    const temasResponse = await fetch(`/get_temas_by_responsavel?responsavel=${encodeURIComponent(responsavel)}`);
                    if (!temasResponse.ok) {
                        const errorText = await temasResponse.text();
                        throw new Error(`HTTP error! status: ${temasResponse.status} - ${errorText}`);
                    }
                    const temas = await temasResponse.json();
                    populateDatalist(temas, 'temas-list-presenca');
                    
                } catch (error) {
                    console.error('ERRO JS: Erro ao carregar temas por responsável:', error);
                    if (temasPresencaDatalist) temasPresencaDatalist.innerHTML = '';
                    if (turmaPresencaDatalist) turmaPresencaDatalist.innerHTML = '';
                }
            } else {
                loadAllDatalistsOptimized();
            }
        });
    }

    if (temaPresencaInput && responsavelPresencaInput) {
        temaPresencaInput.addEventListener('change', async function() {
            const tema = this.value;
            const responsavel = responsavelPresencaInput.value;
            console.log(`DEBUG JS: Tema de presença alterado para: ${tema}. Responsável: ${responsavel}`);
            turmaPresencaInput.value = '';
            participantesContainer.innerHTML = '';
            if (turmaPresencaDatalist) turmaPresencaDatalist.innerHTML = '';

            if (tema && responsavel) {
                try {
                    const response = await fetch(`/get_turmas_by_tema_and_responsavel_basic?responsavel=${encodeURIComponent(responsavel)}&tema=${encodeURIComponent(tema)}`);
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                    }
                    const turmas_filtradas = await response.json();
                    populateDatalist(turmas_filtradas || [], 'turmas-list');
                    console.log(`DEBUG JS: Turmas filtradas por tema e responsável: ${turmas_filtradas.length}.`);
                } catch (error) {
                    console.error('ERRO JS: Erro ao carregar turmas por tema e responsável:', error);
                }
            } else if (responsavel) {
                const response = await fetch(`/get_turmas_by_responsavel?responsavel=${encodeURIComponent(responsavel)}`);
                if (response.ok) {
                    const data = await response.json();
                    populateDatalist(data.turmas || [], 'turmas-list');
                }
            }
        });
    }

    if (turmaPresencaInput && participantesContainer) {
        turmaPresencaInput.addEventListener('change', async function() {
            const turma = this.value;
            console.log(`DEBUG JS: Turma de presença alterada para: ${turma}`);
            participantesContainer.innerHTML = '';
            if (turma) {
                try {
                    const response = await fetch(`/get_participantes_by_turma?turma=${encodeURIComponent(turma)}`);
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                    }
                    const participantes = await response.json();

                    if (participantes.length > 0) {
                        participantes.forEach(participante => {
                            const div = document.createElement('div');
                            div.classList.add('participante-item');
                            div.innerHTML = `
                                <span class="participante-nome">${participante.nome}</span>
                                <span class="participante-info">(${participante.diretoria_de_ensino || 'N/A'} - ${participante.escola || 'N/A'}) - ${participante.etapa || 'N/A'}</span>
                                <div class="radio-group">
                                    <label>Presença:
                                        <input type="radio" name="presenca_${participante.cpf}" value="SIM" required> SIM
                                        <input type="radio" name="presenca_${participante.cpf}" value="NÃO"> NÃO
                                    </label>
                                    <label>Câmera:
                                        <input type="radio" name="camera_${participante.cpf}" value="SIM" required> SIM
                                        <input type="radio" name="camera_${participante.cpf}" value="NÃO"> NÃO
                                    </label>
                                </div>
                                <input type="hidden" name="participante_${participante.cpf}" value="${participante.nome}">
                                <input type="hidden" name="cpf_${participante.cpf}" value="${participante.cpf}">
                                <input type="hidden" name="escola_${participante.cpf}" value="${participante.escola}">
                                <input type="hidden" name="de_${participante.cpf}" value="${participante.diretoria_de_ensino}">
                                <input type="hidden" name="di_${participante.cpf}" value="${participante.di || ''}">
                                <input type="hidden" name="pei_${participante.cpf}" value="${participante.pei || ''}">
                                <input type="hidden" name="declinou_${participante.cpf}" value="${participante.declinou || ''}">
                            `;
                            participantesContainer.appendChild(div);

                            const presencaRadios = div.querySelectorAll(`input[name="presenca_${participante.cpf}"]`);
                            const cameraRadios = div.querySelectorAll(`input[name="camera_${participante.cpf}"]`);

                            presencaRadios.forEach(radio => {
                                radio.addEventListener('change', function() {
                                    const isPresent = this.value === 'SIM';
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
                                            // Se a presença é 'SIM', marca a câmera como 'SIM' automaticamente
                                            if (cameraRadio.value === 'SIM') {
                                                cameraRadio.checked = true;
                                            }
                                        }
                                    });
                                });
                            });
                        });
                        console.log(`DEBUG JS: Participantes carregados para a turma '${turma}': ${participantes.length}.`);
                    } else {
                        participantesContainer.innerHTML = '<p>Nenhum participante encontrado para esta turma.</p>';
                        console.log(`DEBUG JS: Nenhum participante encontrado para a turma '${turma}'.`);
                    }
                } catch (error) {
                    console.error('ERRO JS: Erro ao carregar participantes:', error);
                    participantesContainer.innerHTML = '<p>Erro ao carregar participantes. Tente novamente.</p>';
                }
            }
        });
    }

    // ====================================================================
    // Lógica para o Formulário de Acompanhamento de Encontros (ATUALIZADO)
    // ====================================================================
    const turmaAcompanhamentoInput = document.getElementById('turma_acompanhamento');
    const temaAcompanhamentoInput = document.getElementById('tema_acompanhamento');
    const formadorAssistidoInput = document.getElementById('formador_assistido');
    const esperadoParticipantesInput = document.getElementById('esperado_participantes');
    const encontroRealizadoSimSection = document.getElementById('encontro-realizado-sim');
    const encontroRealizadoNaoSection = document.getElementById('encontro-realizado-nao');
    const formadorSubstituicaoGroup = document.querySelector('input[name="formador_substituicao"]');
    const substitutoContainer = document.getElementById('substituto-container');
    const nomeSubstitutoInput = document.getElementById('nome_substituto');

    // Ação em cascata: quando a turma muda, preenche o tema e o formador
    if (turmaAcompanhamentoInput) {
        turmaAcompanhamentoInput.addEventListener('change', async function() {
            const turma = this.value;
            if (turma) {
                try {
                    // 1. Preenche o nome do formador (responsável pela turma)
                    const formadorResponse = await fetch(`/get_formador_assistido?turma=${encodeURIComponent(turma)}`);
                    if (!formadorResponse.ok) {
                        const errorText = await formadorResponse.text();
                        throw new Error(`HTTP error! status: ${formadorResponse.status} - ${errorText}`);
                    }
                    const formadorData = await formadorResponse.json();
                    if (formadorData.length > 0) {
                        formadorAssistidoInput.value = formadorData[0];
                    } else {
                        formadorAssistidoInput.value = '';
                    }

                    // 2. Preenche o tema com base na turma
                    const temaResponse = await fetch(`/get_tema_by_turma?turma=${encodeURIComponent(turma)}`);
                    if (!temaResponse.ok) {
                        const errorText = await temaResponse.text();
                        throw new Error(`HTTP error! status: ${temaResponse.status} - ${errorText}`);
                    }
                    const temaData = await temaResponse.json();
                    if (temaData.length > 0) {
                        temaAcompanhamentoInput.value = temaData[0];
                    } else {
                        temaAcompanhamentoInput.value = '';
                    }

                    // 3. Conta o número de participantes para o campo 'esperado_participantes'
                    const participantesResponse = await fetch(`/get_participantes_by_turma?turma=${encodeURIComponent(turma)}`);
                    if (!participantesResponse.ok) {
                        const errorText = await participantesResponse.text();
                        throw new Error(`HTTP error! status: ${participantesResponse.status} - ${errorText}`);
                    }
                    const participantes = await participantesResponse.json();
                    esperadoParticipantesInput.value = participantes.length;

                } catch (error) {
                    console.error('ERRO JS: Erro ao carregar dados do acompanhamento:', error);
                }
            } else {
                formadorAssistidoInput.value = '';
                temaAcompanhamentoInput.value = '';
                esperadoParticipantesInput.value = '';
            }
        });
    }

    if (document.querySelector('input[name="encontro_realizado"]')) {
        document.querySelectorAll('input[name="encontro_realizado"]').forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.value === 'Sim') {
                    encontroRealizadoSimSection.style.display = 'block';
                    encontroRealizadoNaoSection.style.display = 'none';
                    encontroRealizadoNaoSection.querySelectorAll('input, select').forEach(el => el.required = false);
                    encontroRealizadoSimSection.querySelectorAll('input, select').forEach(el => el.required = true);
                } else {
                    encontroRealizadoSimSection.style.display = 'none';
                    encontroRealizadoNaoSection.style.display = 'block';
                    encontroRealizadoSimSection.querySelectorAll('input, select').forEach(el => el.required = false);
                    encontroRealizadoNaoSection.querySelectorAll('input, select').forEach(el => el.required = true);
                }
            });
        });
    }

    if (document.querySelector('input[name="formador_substituicao"]')) {
        document.querySelectorAll('input[name="formador_substituicao"]').forEach(radio => {
            radio.addEventListener('change', function() {
                if (this.value === 'nao_se_aplica') {
                    formadorAssistidoInput.value = 'Não se aplica';
                    formadorAssistidoInput.readOnly = true;
                    substitutoContainer.style.display = 'block';
                    nomeSubstitutoInput.required = true;
                } else {
                    formadorAssistidoInput.readOnly = false;
                    substitutoContainer.style.display = 'none';
                    nomeSubstitutoInput.required = false;
                    const turmaInput = document.getElementById('turma_acompanhamento');
                    if (turmaInput.value) {
                        turmaInput.dispatchEvent(new Event('change'));
                    }
                }
            });
        });
    }

    // ====================================================================
    // Lógica para o Formulário de Avaliação
    // ====================================================================

    const nomeObservadoAvaliacaoInput = document.getElementById('nome_observado_avaliacao');
    const codigoTurmaAvaliacaoInput = document.getElementById('codigo_turma_avaliacao');
    const temaObservadoAvaliacaoInput = document.getElementById('tema_observado_avaliacao');
    const cpfObservadoAvaliacaoInput = document.getElementById('cpf_observado_avaliacao');
    const diretoriaAvaliacaoInput = document.getElementById('diretoria_de_ensino_avaliacao');
    const escolaAvaliacaoInput = document.getElementById('escola_avaliacao');

    const temasObservadoDatalist = document.getElementById('temas-observado-list');
    const turmasObservadoDatalist = document.getElementById('turmas-observado-list');

    if (nomeObservadoAvaliacaoInput) {
        nomeObservadoAvaliacaoInput.addEventListener('change', async function() {
            const nome_responsavel_selecionado = this.value;
            console.log(`DEBUG JS: Nome do observado (responsável) alterado para: ${nome_responsavel_selecionado}`);
            cpfObservadoAvaliacaoInput.value = '';
            diretoriaAvaliacaoInput.value = '';
            escolaAvaliacaoInput.value = '';
            temaObservadoAvaliacaoInput.value = '';
            codigoTurmaAvaliacaoInput.value = '';

            if (temasObservadoDatalist) temasObservadoDatalist.innerHTML = '';
            if (turmasObservadoDatalist) turmasObservadoDatalist.innerHTML = '';

            if (nome_responsavel_selecionado) {
                try {
                    const response = await fetch(`/get_info_by_nome_or_cpf?search_term=${encodeURIComponent(nome_responsavel_selecionado)}`);
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                    }
                    const data = await response.json();

                    if (Object.keys(data).length > 0) {
                        cpfObservadoAvaliacaoInput.value = data.cpf || '';
                        diretoriaAvaliacaoInput.value = data.diretoria_de_ensino || '';
                        escolaAvaliacaoInput.value = data.escola || '';

                        populateDatalist(data.temas || [], 'temas-observado-list');
                        populateDatalist(data.turmas || [], 'turmas-observado-list');
                        console.log(`DEBUG JS: Dados do observado carregados para '${nome_responsavel_selecionado}'. Temas: ${data.temas.length}, Turmas: ${data.turmas.length}.`);

                    } else {
                        console.log("DEBUG JS: Nenhum dado encontrado para o nome selecionado.");
                    }
                } catch (error) {
                    console.error('ERRO JS: Erro ao carregar dados do observado:', error);
                }
            }
        });
    }

    if (temaObservadoAvaliacaoInput && nomeObservadoAvaliacaoInput) {
        temaObservadoAvaliacaoInput.addEventListener('change', async function() {
            const tema_selecionado = this.value;
            const responsavel_selecionado = nomeObservadoAvaliacaoInput.value;
            console.log(`DEBUG JS: Tema observado alterado para: ${tema_selecionado}, Responsável: ${responsavel_selecionado}`);

            codigoTurmaAvaliacaoInput.value = '';
            if (turmasObservadoDatalist) turmasObservadoDatalist.innerHTML = '';

            if (tema_selecionado && responsavel_selecionado) {
                try {
                    const response = await fetch(`/get_turmas_by_tema_and_responsavel?responsavel=${encodeURIComponent(responsavel_selecionado)}&tema=${encodeURIComponent(tema_selecionado)}`);
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                    }
                    const turmas_filtradas = await response.json();
                    populateDatalist(turmas_filtradas || [], 'turmas-observado-list');
                    console.log(`DEBUG JS: Turmas filtradas por tema e responsável: ${turmas_filtradas.length}.`);
                } catch (error) {
                    console.error('ERRO JS: Erro ao carregar turmas por tema e responsável:', error);
                }
            } else if (responsavel_selecionado) {
                console.log("DEBUG JS: Tema limpo, recarregando todas as turmas para o responsável.");
                const response = await fetch(`/get_info_by_nome_or_cpf?search_term=${encodeURIComponent(responsavel_selecionado)}`);
                if (response.ok) {
                    const data = await response.json();
                    populateDatalist(data.turmas || [], 'turmas-observado-list');
                }
            }
        });
    }


    window.calculateScore = function() {
        const form = document.getElementById('formAvaliacao');
        let totalWeightedAchievedScore = 0;
        let totalPossibleWeightedScore = 0;

        const dimensionsConfig = {
            'Dimensão 1': { questions: ['q1_1', 'q1_2', 'q1_3'], weight: 1 },
            'Dimensão 2': { questions: ['q2_1', 'q2_2', 'q2_3'], weight: 2 },
            'Dimensão 3': { questions: ['q3_1', 'q3_2', 'q3_3'], weight: 2 },
            'Dimensão 4': { questions: ['q4_1', 'q4_2', 'q4_3'], weight: 2 },
            'Dimensão 5': { questions: ['q5_1', 'q5_2', 'q5_3'], weight: 2 }
        };

        // CORRIGIDO: Mapeamento de score para a nova escala
        const scoreMap = { 'Atende': 1, 'Não Atende': 0 };

        for (const dimName in dimensionsConfig) {
            const { questions, weight } = dimensionsConfig[dimName];
            let dimensionCurrentRawScore = 0;
            let answeredQuestionsInDimension = 0;

            questions.forEach(q => {
                const selected = form.querySelector(`input[name="${q}"]:checked`);
                if (selected) {
                    // Usar o score da nova escala
                    dimensionCurrentRawScore += scoreMap[selected.value] !== undefined ? scoreMap[selected.value] : 0;
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
    };

    // ====================================================================
    // Lógica para o Formulário de Registro de Demandas Semanais
    // ====================================================================
    const cpfPecDemandasInput = document.getElementById('cpf_pec_demandas');
    const pecDemandasInput = document.getElementById('pec_demandas');
    const diretoriaDemandasInput = document.getElementById('diretoria_demandas');
    const escolasContainer = document.getElementById('escolas-container');
    const escolasCheckboxContainer = document.getElementById('escolas-checkbox-container');
    
    // NOVOS CAMPOS (agora editáveis)
    const pmOrientadosInput = document.getElementById('pm_orientados_demandas');
    const cursistasOrientadosInput = document.getElementById('cursistas_orientados_demandas');
    const formacoesRealizadasInput = document.getElementById('formacoes_realizadas_demandas');
    const substituicoesRealizadasInput = document.getElementById('substituicoes_realizadas_demandas');
    
    // Novos campos de contagem total (agora lidos do backend)
    const pmOrientadosEsperadoInput = document.getElementById('pm_orientados_esperado_demandas');
    const cursistasOrientadosEsperadoInput = document.getElementById('cursistas_orientados_esperado_demandas');

    if (cpfPecDemandasInput) {
        cpfPecDemandasInput.addEventListener('change', async function() {
            const cpf = this.value;
            console.log(`DEBUG JS: CPF do PEC de demandas alterado para: ${cpf}`);
            
            // Limpa os campos, mas mantém a edição manual possível
            pecDemandasInput.value = '';
            diretoriaDemandasInput.value = '';
            pmOrientadosEsperadoInput.value = '';
            cursistasOrientadosEsperadoInput.value = '';

            try {
                const response = await fetch(`/get_info_by_nome_or_cpf?search_term=${encodeURIComponent(cpf)}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }
                const data = await response.json();
                
                if (Object.keys(data).length > 0) {
                    pecDemandasInput.value = data.nome || '';
                    diretoriaDemandasInput.value = data.diretoria_de_ensino || '';
                    console.log(`DEBUG JS: Dados do PEC carregados para o CPF '${cpf}'.`);
                } else {
                    pecDemandasInput.value = '';
                    diretoriaDemandasInput.value = '';
                    console.log("DEBUG JS: Nenhum dado encontrado para o CPF selecionado.");
                }

                if (document.querySelector('input[name="visitas_escolas_demandas"]:checked')?.value === 'Sim') {
                    loadSchoolsByDiretoria();
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao carregar dados do PEC:', error);
            }
        });
    }


    window.toggleSchoolSelection = function(radioGroup) {
        const selectedValue = radioGroup.querySelector('input:checked')?.value;
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
                // NOVOS CAMPOS
                if (pmOrientadosEsperadoInput) pmOrientadosEsperadoInput.value = 0;
                if (cursistasOrientadosEsperadoInput) cursistasOrientadosEsperadoInput.value = 0;
            }
        }
    };

    if (document.querySelector('input[name="visitas_escolas_demandas"]')) {
        document.querySelectorAll('input[name="visitas_escolas_demandas"]').forEach(radio => {
            radio.addEventListener('change', function() {
                window.toggleSchoolSelection(this.closest('.radio-group'));
            });
        });
    }

    if (diretoriaDemandasInput) {
        diretoriaDemandasInput.addEventListener('change', function() {
            console.log(`DEBUG JS: Diretoria de demandas alterada para: ${this.value}`);
            if (document.querySelector('input[name="visitas_escolas_demandas"]:checked')?.value === 'Sim') {
                loadSchoolsByDiretoria();
            }
        });
    }

    async function loadSchoolsByDiretoria() {
        const diretoria = diretoriaDemandasInput.value;
        console.log(`DEBUG JS: Carregando escolas para a diretoria: ${diretoria}`);
        if (diretoria && escolasCheckboxContainer) {
            try {
                const response = await fetch(`/get_schools_by_de?diretoria=${encodeURIComponent(diretoria)}`);
                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                }
                const schools = await response.json();
                escolasCheckboxContainer.innerHTML = '';
                schools.forEach(school => {
                    const label = document.createElement('label');
                    const checkbox = document.createElement('input');
                    checkbox.type = 'checkbox';
                    checkbox.name = 'escolas_visitadas_demandas';
                    checkbox.value = school;
                    checkbox.addEventListener('change', window.countParticipants);
                    label.appendChild(checkbox);
                    label.appendChild(document.createTextNode(school));
                    escolasCheckboxContainer.appendChild(label);
                });
                console.log(`DEBUG JS: Escolas carregadas para '${diretoria}': ${schools.length}.`);
                window.countParticipants();
            } catch (error) {
                console.error('ERRO JS: Erro ao carregar escolas por diretoria:', error);
                escolasCheckboxContainer.innerHTML = '';
            }
        } else if (escolasCheckboxContainer) {
            escolasCheckboxContainer.innerHTML = '';
        }
    };

    window.countParticipants = async function() {
        if (!escolasCheckboxContainer) return;
        const selectedSchools = Array.from(escolasCheckboxContainer.querySelectorAll('input[type="checkbox"]:checked')).map(checkbox => checkbox.value);
        console.log(`DEBUG JS: Contando participantes para escolas selecionadas: ${selectedSchools.join(', ')}`);
        if (selectedSchools.length > 0) {
            try {
                const response = await fetch(`/get_counts_by_schools?escolas=${encodeURIComponent(selectedSchools.join(','))}`);
                if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
                    }
                const data = await response.json();
                
                // CORREÇÃO: Apenas os campos 'esperado' são preenchidos
                if (pmOrientadosEsperadoInput) pmOrientadosEsperadoInput.value = data.pm_total;
                if (cursistasOrientadosEsperadoInput) cursistasOrientadosEsperadoInput.value = data.pc_total;
                
                console.log(`DEBUG JS: Total PMs na UE: ${data.pm_total}, Total PCs na UE: ${data.pc_total}`);
            } catch (error) {
                console.error('ERRO JS: Erro ao contar participantes:', error);
                if (pmOrientadosEsperadoInput) pmOrientadosEsperadoInput.value = 0;
                if (cursistasOrientadosEsperadoInput) cursistasOrientadosEsperadoInput.value = 0;
            }
        } else {
            if (pmOrientadosInput) pmOrientadosInput.value = 0;
            if (cursistasOrientadosInput) cursistasOrientadosInput.value = 0;
            // CORREÇÃO: Apenas os campos 'esperado' são preenchidos
            if (pmOrientadosEsperadoInput) pmOrientadosEsperadoInput.value = 0;
            if (cursistasOrientadosEsperadoInput) cursistasOrientadosEsperadoInput.value = 0;
        }
    };

    // ====================================================================
    // Lógica para o Formulário de Registro de Ocorrência (NOVO)
    // ====================================================================

    const nomeOcorrenciaInput = document.getElementById('nome_ocorrencia');
    const emailOcorrenciaInput = document.getElementById('email_ocorrencia');
    const telefoneOcorrenciaInput = document.getElementById('telefone_ocorrencia');
    const turmaOcorrenciaInput = document.getElementById('turma_ocorrencia');
    const temaOcorrenciaInput = document.getElementById('tema_ocorrencia');
    const tipoOcorrenciaSelect = document.getElementById('tipo_ocorrencia');
    const outraOcorrenciaContainer = document.getElementById('outra_ocorrencia_desc_container');
    const outraOcorrenciaDescInput = document.getElementById('outra_ocorrencia_desc');

    if (nomeOcorrenciaInput) {
        nomeOcorrenciaInput.addEventListener('change', async function() {
            const nome_completo = this.value;
            try {
                const response = await fetch(`/get_user_info_by_name?nome=${encodeURIComponent(nome_completo)}`);
                const data = await response.json();
                if (data.email) emailOcorrenciaInput.value = data.email;
                if (data.telefone) telefoneOcorrenciaInput.value = data.telefone;
            } catch (error) {
                console.error("ERRO JS: Não foi possível carregar dados do usuário.");
                emailOcorrenciaInput.value = '';
                telefoneOcorrenciaInput.value = '';
            }
        });
    }

    if (turmaOcorrenciaInput) {
        turmaOcorrenciaInput.addEventListener('change', async function() {
            const turma = this.value;
            try {
                const response = await fetch(`/get_tema_by_turma?turma=${encodeURIComponent(turma)}`);
                const data = await response.json();
                if (data.length > 0) {
                    temaOcorrenciaInput.value = data[0];
                } else {
                    temaOcorrenciaInput.value = '';
                }
            } catch (error) {
                console.error("ERRO JS: Não foi possível carregar o tema da turma.");
                temaOcorrenciaInput.value = '';
            }
        });
    }

    if (tipoOcorrenciaSelect) {
        tipoOcorrenciaSelect.addEventListener('change', function() {
            if (this.value === 'Outra') {
                outraOcorrenciaContainer.style.display = 'block';
                outraOcorrenciaDescInput.required = true;
            } else {
                outraOcorrenciaContainer.style.display = 'none';
                outraOcorrenciaDescInput.required = false;
                outraOcorrenciaDescInput.value = '';
            }
        });
    }
    
    // ====================================================================
    // Lógica para o modal de edição (ATUALIZADO)
    // ====================================================================
    const editModal = document.getElementById('editModal');
    const editModalContent = document.getElementById('editModalContent');
    const closeButtons = document.querySelectorAll('.close-button');
    let currentRecordId = null;
    let currentTableId = null;

    // NOVO: Função para fechar o modal
    window.closeModal = function() {
        editModal.style.display = "none";
        document.body.style.overflow = 'auto'; // Reabilita o scroll
    }
    
    // Anexa a função de fechar o modal aos botões de fechar e ao clique no backdrop
    closeButtons.forEach(button => {
        button.onclick = window.closeModal;
    });

    window.onclick = function(event) {
        if (event.target == editModal) {
            window.closeModal();
        }
    };

    const editModalHtmlTemplates = {
        'presenca': (record) => `
            <h3>Editar Registro de Presença</h3>
            <form id="editForm">
                <input type="hidden" name="id" value="${record.id}">
                <p><strong>Participante:</strong> ${record.nome_participante}</p>
                <p><strong>Turma:</strong> ${record.turma}</p>
                <p><strong>Data:</strong> ${record.data_formacao}</p>
                
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
                <p><strong>Data:</strong> ${record.data_encontro}</p>

                <label>Encontro Realizado:</label>
                <div class="radio-group">
                    <label><input type="radio" name="encontro_realizado" value="Sim" ${record.encontro_realizado === 'Sim' ? 'checked' : ''}> Sim</label>
                    <label><input type="radio" name="encontro_realizado" value="Não" ${record.encontro_realizado === 'Não' ? 'checked' : ''}> Não</label>
                </div>

                ${record.encontro_realizado === 'Sim' ? `
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
                ` : `
                    <label for="motivo_nao_ocorrencia">Motivo da não ocorrência:</label>
                    <textarea name="motivo_nao_ocorrencia">${record.motivo_nao_ocorrencia || ''}</textarea>
                `}
                
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
                <p><strong>Data:</strong> ${record.data_acompanhamento}</p>
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
                <p><strong>Data:</strong> ${record.data_formacao}</p>
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
                <p><strong>Relator:</strong> ${record.nome_ocorrencia}</p>
                <p><strong>Turma:</strong> ${record.turma_ocorrencia}</p>
                <p><strong>Tipo:</strong> ${record.tipo_ocorrencia}</p>
                <label for="email_ocorrencia">E-mail:</label>
                <input type="email" name="email_ocorrencia" value="${record.email_ocorrencia || ''}">
                <label for="telefone_ocorrencia">Telefone:</label>
                <input type="tel" name="telefone_ocorrencia" value="${record.telefone_ocorrencia || ''}">
                <label for="descricao_problema">Descrição do Problema:</label>
                <textarea name="descricao_problema" rows="4">${record.descricao_problema || ''}</textarea>
                <label>A ocorrência ainda está acontecendo?</label>
                <div class="radio-group">
                    <label><input type="radio" name="ocorrencia_ainda_ocorre" value="Sim" ${record.ocorrencia_ainda_ocorre === 'Sim' ? 'checked' : ''}> Sim</label>
                    <label><input type="radio" name="ocorrencia_ainda_ocorre" value="Não" ${record.ocorrencia_ainda_ocorre === 'NÃO' ? 'checked' : ''}> Não</label>
                </div>
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
                    <option value="basic_access" ${record.access_level === 'basic_access' ? 'selected' : ''}>Basic Access (PM/CM)</option>
                    <option value="full_access" ${record.access_level === 'full_access' ? 'selected' : ''}>Full Access (PEC/Formador/EFAPE/CAFF)</option>
                    <option value="super_admin" ${record.access_level === 'super_admin' ? 'selected' : ''}>Super Admin (ADM)</option>
                </select>
                <div class="button-group">
                    <button type="submit" class="modal-save-button">Salvar</button>
                    <button type="button" class="modal-close-button close-button" onclick="closeModal()">Cancelar</button>
                </div>
            </form>
        `
    };

    window.openEditModal = async function(recordId, tableId) {
        currentRecordId = recordId;
        currentTableId = tableId;
    
        editModal.style.display = "block";
        document.body.style.overflow = 'hidden';
        editModalContent.innerHTML = 'Carregando...';
    
        try {
            let url;
            let record;
            if (tableId === 'participantes_base_editavel' || tableId === 'usuarios') {
                url = `/get_record/${tableId}/${recordId}`;
                const response = await fetch(url);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Erro ao carregar o registro.');
                }
                record = await response.json();
            } else {
                url = `/get_record/${tableId}/${recordId}`;
                const response = await fetch(url);
                if (!response.ok) {
                    const errorData = await response.json();
                    throw new Error(errorData.error || 'Erro ao carregar o registro.');
                }
                record = await response.json();
            }

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
                    const endpoint = `/edit_record/${tableId}`;
                    
                    try {
                        const res = await fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(data)
                        });
                        const result = await res.json();
                        alert(result.message);
                        if (result.success) {
                            window.closeModal();
                            fetchResults(tableId, currentPage[tableId] || 1);
                        }
                    } catch (error) {
                        console.error('ERRO JS: Erro ao salvar edição:', error);
                        alert('Erro ao salvar a edição. Tente novamente.');
                    }
                });
            }
        } catch (error) {
            editModalContent.innerHTML = `<p style="color:red;">${error.message}</p>`;
            console.error('ERRO JS:', error);
        }
    };
    
    // ====================================================================
    // Lógica para Resultados das Tabelas (Geral) (ATUALIZADO)
    // ====================================================================
    async function fetchResults(tableId, page = 1) {
        console.log(`DEBUG JS: Buscando resultados para a tabela: ${tableId}, página: ${page}`);
        const resultsTableBody = document.querySelector(`#table-${tableId} tbody`);
        const tableHeadRow = document.querySelector(`#table-${tableId} thead tr`);
        const metricsContainer = document.querySelector(`#metrics-${tableId}`);
        const paginationContainer = document.querySelector(`#pagination-${tableId}`);
        const exportButton = document.getElementById(`exportCsv${tableId.charAt(0).toUpperCase() + tableId.slice(1)}`);
        const filterForm = document.getElementById(`filterForm${tableId.charAt(0).toUpperCase() + tableId.slice(1)}`);


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
            console.log(`DEBUG JS: Chamando API /get_results/${tableId}?${queryParams.toString()}`);
            const response = await fetch(`/get_results/${tableId}?${queryParams.toString()}`);
            if (!response.ok) {
                const errorText = await response.text();
                if (response.status === 403) {
                    resultsTableBody.innerHTML = `<tr><td colspan="100%">Acesso negado para este relatório.</td></tr>`;
                    if (metricsContainer) metricsContainer.innerHTML = '';
                    console.error(`ERRO JS: Acesso negado para relatório '${tableId}'.`);
                    return;
                }
                throw new Error(`Falha na resposta da API: ${response.status} - ${errorText}`);
            }
            const data = await response.json();
            console.log(`DEBUG JS: Dados recebidos para ${tableId}:`, data);

            const results = data.results;
            const columns = data.columns;
            const totalItemsCount = data.total_items;
            const perPage = data.per_page;

            currentPage[tableId] = page;
            totalItems[tableId] = totalItemsCount;
            
            const userResponse = await fetch('/get_user_info');
            const userData = await userResponse.json();
            const userAccessLevel = userData.access_level;
            const userCpf = userData.cpf;
            const userName = userData.nome;

            const columnDisplayNames = {
                'id': 'ID',
                'responsavel_acompanhamento': 'Responsável pelo Acompanhamento',
                'formador_assistido': 'Responsável pela Formação',
                'encontro_realizado': 'Encontro Realizado?',
                'num_participantes_esperados': 'Participantes Esperados',
                'real_participantes': 'Participantes Reais',
                'camera_aberta_participantes': 'Câmera Aberta',
                'motivo_nao_ocorrencia': 'Motivo Não Ocorrência',
                'data_encontro': 'Data do Encontro',
                'semana': 'Semana',
                'diretoria_de_ensino_resp': 'Diretoria do Responsável',
                'responsavel': 'Responsável',
                'substituicao_ocorreu': 'Houve Substituição?',
                'nome_substituto': 'Nome do Substituto',
                'tema': 'Tema',
                'turma': 'Turma',
                'data_formacao': 'Data da Formação',
                'pauta': 'Pauta Formativa',
                'observacao': 'Observação',
                'nome_participante': 'Nome do Participante',
                'cpf_participante': 'CPF do Participante',
                'escola_participante': 'Escola do Participante',
                'de_participante': 'DE do Participante',
                'di_participante': 'DI',
                'pei_participante': 'PEI',
                'declinou_participante': 'Declinou',
                'presenca': 'Presença',
                'camera': 'Câmera',
                'observador': 'Observador',
                'funcao': 'Função',
                'data_acompanhamento': 'Data Acompanhamento',
                'data_feedback': 'Data Feedback',
                'observado': 'Nome Observado',
                'cpf_observado': 'CPF Observado',
                'diretoria_de_ensino': 'Diretoria de Ensino',
                'escola': 'Escola',
                'tema_observado': 'Tema Observado',
                'codigo_turma': 'Código da Turma',
                'pauta_formativa': 'Pauta Formativa',
                'link_gravacao': 'Link Gravação',
                'nota_final': 'Nota Final',
                'feedback_estruturado': 'Feedback Estruturado',
                'observacoes_gerais': 'Observações Gerais',
                'pec': 'PEC Multiplica',
                'cpf_pec': 'CPF do PEC',
                'semana': 'Semana de Referência',
                'caff': 'CAFF Responsável',
                'formacoes_realizadas': 'Formações Realizadas',
                'alinhamento_semanal': 'Alinhamento Semanal Síncrono',
                'alinhamento_geral': 'Alinhamento Geral Síncrono',
                'visitas_escolas': 'Visitas às Escolas',
                'escolas_visitadas': 'Escolas Visitadas',
                'pm_orientados': 'PMs Orientados',
                'cursistas_orientados': 'Cursistas Orientados',
                'pm_orientados_esperado': 'PMs na UE',
                'cursistas_orientados_esperado': 'Cursistas na UE',
                'rubricas_preenchidas': 'Rubricas Preenchidas',
                'feedbacks_realizados': 'Feedbacks Realizados',
                'substituicoes_realizadas': 'Substituições Realizadas',
                'engajamento': 'Ações de Engajamento',
                'valor_formacao': 'Valor da Formação',
                'nome_ocorrencia': 'Nome Relator',
                'email_ocorrencia': 'E-mail',
                'telefone_ocorrencia': 'Telefone',
                'turma_ocorrencia': 'Turma',
                'tema_ocorrencia': 'Tema',
                'tipo_ocorrencia': 'Tipo',
                'outra_ocorrencia_desc': 'Outra Descrição',
                'descricao_problema': 'Descrição do Problema',
                'ocorrencia_ainda_ocorre': 'Ainda Ocorre?',
                'nivel_impacto': 'Nível de Impacto',
                'timestamp': 'Data/Hora Registro',
                // Colunas para a tabela de participantes
                'nome': 'Nome',
                'cpf': 'CPF',
                'escola': 'Escola',
                'diretoria_de_ensino': 'Diretoria de Ensino',
                'tema': 'Tema',
                'responsavel': 'Responsável',
                'turma': 'Turma',
                'etapa': 'Etapa',
                'di': 'DI',
                'pei': 'PEI',
                'declinou': 'Declinou',
                // Colunas para a tabela de usuários
                'password_hash': 'Hash da Senha',
                'access_level': 'Nível de Acesso'
            };


            const desiredOrder = {
                'presenca': ['id', 'diretoria_de_ensino_resp', 'responsavel', 'substituicao_ocorreu', 'nome_substituto', 'tema', 'turma', 'data_formacao', 'pauta', 'observacao', 'nome_participante', 'cpf_participante', 'escola_participante', 'de_participante', 'di_participante', 'pei_participante', 'declinou_participante', 'presenca', 'camera'],
                'ocorrencias': ['id', 'nome_ocorrencia', 'email_ocorrencia', 'telefone_ocorrencia', 'turma_ocorrencia', 'tema_ocorrencia', 'tipo_ocorrencia', 'outra_ocorrencia_desc', 'descricao_problema', 'ocorrencia_ainda_ocorre', 'nivel_impacto', 'timestamp'],
                'acompanhamento': [
                    'id', 'responsavel_acompanhamento', 'formador_assistido', 'turma', 'tema', 'pauta', 'data_encontro', 'semana',
                    'encontro_realizado', 'dia_semana_encontro', 'horario_encontro', 'esperado_participantes', 'real_participantes',
                    'camera_aberta_participantes', 'motivo_nao_ocorrencia', 'observacao'
                ],
                'demandas': ['id', 'pec', 'cpf_pec', 'semana', 'caff', 'diretoria_de_ensino', 'formacoes_realizadas', 'alinhamento_semanal', 'visitas_escolas', 'escolas_visitadas', 'pm_orientados', 'cursistas_orientados', 'pm_orientados_esperado', 'cursistas_orientados_esperado', 'rubricas_preenchidas', 'feedbacks_realizados', 'substituicoes_realizadas', 'engajamento', 'observacao'],
                'ateste': ['id', 'responsavel_base', 'nome_quem_preencheu', 'tema', 'turma', 'data_formacao', 'diretoria_de_ensino', 'escola', 'cpf', 'valor_formacao'],
                'participantes_base_editavel': ['cpf', 'nome', 'escola', 'diretoria_de_ensino', 'tema', 'responsavel', 'turma', 'etapa', 'di', 'pei', 'declinou'],
                'usuarios': ['id', 'cpf', 'access_level']
            };

            let orderedColumns = [];
            if (desiredOrder[tableId]) {
                orderedColumns = desiredOrder[tableId].filter(col => columns.includes(col));
                const remainingCols = columns.filter(col => !desiredOrder[tableId].includes(col));
                orderedColumns = orderedColumns.concat(remainingCols.sort());
            } else {
                orderedColumns = columns;
            }
            console.log(`DEBUG JS: Colunas ordenadas para ${tableId}:`, orderedColumns);


            const tableHead = document.querySelector(`#table-${tableId} thead tr`);
            tableHead.innerHTML = '';
            const isEditableTable = ['presenca', 'ocorrencias', 'acompanhamento', 'avaliacao', 'demandas', 'ateste', 'participantes_base_editavel', 'usuarios'].includes(tableId);

            if (isEditableTable) {
                const thActions = document.createElement('th');
                thActions.textContent = 'Ações';
                tableHead.appendChild(thActions);
            }

            orderedColumns.forEach(colName => {
                const th = document.createElement('th');
                th.textContent = avaliacaoQuestionsMap[colName] || columnDisplayNames[colName] || colName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                th.title = avaliacaoQuestionsMap[colName] || columnDisplayNames[colName] || colName.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
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
                                case 'ocorrencias':
                                    canEdit = docData.nome_ocorrencia === userName;
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
                        } else if (col.includes('data_') || col === 'timestamp') {
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

            // Lógica para paginação
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
                } else if (tableId === 'ocorrencias') {
                    const numForms = metricsContainer.querySelector(`#ocorrencias-num_ocorrencias`);
                    if (numForms) numForms.textContent = data.metrics.num_ocorrencias || 0;
                    const ocorrenciasAtivas = metricsContainer.querySelector(`#ocorrencias-ocorrencias_ativas`);
                    if (ocorrenciasAtivas) ocorrenciasAtivas.textContent = data.metrics.ocorrencias_ativas || 0;
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
                }
            }
        } catch (error) {
            console.error(`ERRO JS: Erro ao carregar resultados para ${tableId}:`, error);
            if (resultsTableBody) {
                resultsTableBody.innerHTML = `<tr><td colspan="100%">Erro ao carregar dados. Por favor, tente novamente.</td></tr>`;
            }
        }
    }


    function handleFormSubmit(formId, endpoint, successMessage) {
        const form = document.getElementById(formId);
        if (!form) return;

        form.addEventListener('submit', async function(event) {
            event.preventDefault();
            console.log(`DEBUG JS: Submetendo formulário '${formId}' para o endpoint '${endpoint}'.`);

            const formData = new FormData(this);
            const data = {};

            for (let [key, value] of formData.entries()) {
                data[key] = value;
            }
            
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
            }

            if (formId === 'formAcompanhamento') {
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
            }
            
            if (formId === 'formDemandas') {
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
            }
            
            if (formId === 'formOcorrencia') {
                const tipoOcorrencia = data['tipo_ocorrencia'];
                if (tipoOcorrencia !== 'Outra') {
                    delete data['outra_ocorrencia_desc'];
                }
            }
            
            try {
                const response = await fetch(endpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(data)
                });

                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    const result = await response.json();
                    
                    if (!response.ok) {
                        const errorMessage = result.message || `HTTP error! status: ${response.status}`;
                        if (response.status === 403) {
                            alert('Acesso negado para enviar este formulário. Nível de permissão insuficiente.');
                            return;
                        }
                        if (response.status === 409) {
                            alert(errorMessage);
                            return;
                        }
                        alert('Ocorreu um erro ao enviar o formulário: ' + errorMessage);
                        return;
                    }
                    
                    if (result.success) {
                        alert(successMessage);
                        form.reset();

                        if (formId === 'formDemandas') {
                            if (escolasContainer) escolasContainer.style.display = 'none';
                            if (pmOrientadosInput) pmOrientadosInput.value = '';
                            if (cursistasOrientadosInput) cursistasOrientadosInput.value = '';
                            if (pmOrientadosEsperadoInput) pmOrientadosEsperadoInput.value = '';
                            if (cursistasOrientadosEsperadoInput) cursistasOrientadosEsperadoInput.value = '';
                        }
                        if (formId === 'formPresenca') {
                            if (substitutoPresencaContainer) substitutoPresencaContainer.style.display = 'none';
                            if (nomeSubstitutoPresencaInput) nomeSubstitutoPresencaInput.value = '';
                        }
    
                        if (formId === 'formAcompanhamento') {
                            document.getElementById('encontro-realizado-sim').style.display = 'none';
                            document.getElementById('encontro-realizado-nao').style.display = 'none';
                        }
    
                        loadAllDatalistsOptimized();
                        if (formId === 'formPresenca' && participantesContainer) {
                            participantesContainer.innerHTML = '';
                        }
                        if (formId === 'formAvaliacao') {
                            if (temasObservadoDatalist) temasObservadoDatalist.innerHTML = '';
                            if (turmasObservadoDatalist) turmasObservadoDatalist.innerHTML = '';
                        }
    
                        const activeTabButton = document.querySelector('.tab-button.active');
                        if (activeTabButton && activeTabButton.dataset.sectionId) {
                            const sectionId = activeTabButton.dataset.sectionId;
                            const tableId = activeTabButton.dataset.tableId;
                            window.showSection(sectionId, tableId);
                        }
                    } else {
                        alert('Erro: ' + (result.message || 'Ocorreu um erro desconhecido.'));
                    }
                } else {
                    if (response.ok) {
                        alert(successMessage);
                        window.location.reload();
                    } else {
                        alert('Erro ao enviar o formulário. O servidor respondeu com um status de erro.');
                    }
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao enviar o formulário ou processar a resposta:', error);
                alert('Ocorreu um erro inesperado ao enviar o formulário. Por favor, tente novamente.');
            }
        });
    }

    const filterForms = ['Presenca', 'Ocorrencias', 'Avaliacao', 'Demandas', 'Acompanhamento', 'ParticipantesBaseEditavel'];
    filterForms.forEach(formName => {
        const tableId = formName.toLowerCase();
        const form = document.getElementById(`filterForm${formName}`);
        if (form) {
            form.addEventListener('submit', function(event) {
                event.preventDefault();
                const formData = new FormData(this);
                currentFilters[tableId] = Object.fromEntries(formData.entries());
                fetchResults(tableId, 1);
            });
        }

        currentFilters[tableId] = {};
    });

    const filterFormAteste = document.getElementById('filterFormAteste');
    if (filterFormAteste) {
        filterFormAteste.addEventListener('submit', function(event) {
            event.preventDefault();
            const formData = new FormData(this);
            currentFilters['ateste'] = Object.fromEntries(formData.entries());
            fetchResults('ateste', 1);
        });
    }

    const clearFilterButtons = ['Presenca', 'Ocorrencias', 'Avaliacao', 'Demandas', 'Ateste', 'Acompanhamento', 'ParticipantesBaseEditavel'];
    clearFilterButtons.forEach(tableIdCapitalized => {
        const button = document.getElementById(`clearFilters${tableIdCapitalized}`);
        if (button) {
            button.addEventListener('click', () => {
                const form = document.getElementById(`filterForm${tableIdCapitalized}`);
                if (form) {
                    form.reset();
                    const tableId = tableIdCapitalized.toLowerCase();
                    currentFilters[tableId] = {};
                    fetchResults(tableId, 1);
                }
            });
        }
    });

    const exportCsvButtons = ['Avaliacao', 'Presenca', 'Ocorrencias', 'Demandas', 'Ateste', 'Acompanhamento', 'ParticipantesBaseEditavel'];
    exportCsvButtons.forEach(tableIdCapitalized => {
        const button = document.getElementById(`exportCsv${tableIdCapitalized}`);
        if (button) {
            button.addEventListener('click', () => exportTableToCsv(tableIdCapitalized.toLowerCase()));
        }
    });

    function exportTableToCsv(tableId) {
        let queryParams = new URLSearchParams(currentFilters[tableId]);

        const url = `/export_csv/${tableId}?${queryParams.toString()}`;
        console.log(`DEBUG JS: Exportando dados da tabela '${tableId}' da URL: ${url}`);

        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', '');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    
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
                const response = await fetch('/admin/delete_entry', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: recordId,
                        table: table,
                        delete_related: deleteRelated
                    })
                });
    
                const result = await response.json();
                if (result.success) {
                    alert(result.message);
                    fetchResults(table, currentPage[table] || 1);
                } else {
                    alert(`Erro: ${result.message}`);
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao excluir registro:', error);
                alert('Ocorreu um erro ao tentar excluir o registro.');
            }
        }
    };

    const manageUserForm = document.getElementById('manageUserForm');
    const searchCpfInput = document.getElementById('search-cpf');
    const searchButton = document.getElementById('search-button');
    const userDetailsForm = document.getElementById('user-details-form');
    const formCpfInput = document.getElementById('user-cpf');
    const formAccessLevel = document.getElementById('user-access-level');
    const deleteUserButton = document.getElementById('delete-user-button');
    const newUserButton = document.getElementById('new-user-button');
    const saveUserButton = document.getElementById('save-user-button');
    const uploadBaseForm = document.getElementById('uploadBaseForm');
    const uploadStatus = document.getElementById('uploadStatus');

    const resetUserForm = () => {
        searchCpfInput.value = '';
        userDetailsForm.style.display = 'none';
        formCpfInput.value = '';
        formAccessLevel.value = 'no_access';
        formCpfInput.readOnly = false;
        deleteUserButton.style.display = 'none';
        saveUserButton.textContent = 'Adicionar Novo Usuário';
    };


    const populateUserForm = (usuario) => {
        formCpfInput.value = usuario?.cpf || '';
        formAccessLevel.value = usuario?.access_level || 'no_access';
        formCpfInput.readOnly = true;
        deleteUserButton.style.display = 'block';
        saveUserButton.textContent = 'Salvar Nível de Acesso';
        userDetailsForm.style.display = 'block';
    };
    
    if (searchButton) {
        searchButton.addEventListener('click', async () => {
            const cpf = searchCpfInput.value.trim();
            if (!cpf) {
                alert('Por favor, insira um CPF para pesquisar.');
                return;
            }
            try {
                const response = await fetch(`/admin/search_user?cpf=${encodeURIComponent(cpf)}`);
                if (!response.ok) {
                    throw new Error('Falha na resposta da API.');
                }
                const data = await response.json();
                console.log("DEBUG: Dados recebidos da busca:", data);

                if (data.usuario) {
                    populateUserForm(data.usuario);
                    alert('Usuário encontrado. Altere o nível de acesso e salve.');
                } else {
                    const isConfirmed = confirm("Usuário não encontrado. Deseja adicionar um novo usuário com este CPF?");
                    if (isConfirmed) {
                        resetUserForm();
                        formCpfInput.value = cpf;
                        formCpfInput.readOnly = false;
                        userDetailsForm.style.display = 'block';
                        saveUserButton.textContent = 'Adicionar Novo Usuário';
                        alert("Defina o nível de acesso para o novo usuário e clique em 'Adicionar'.");
                    } else {
                        resetUserForm();
                    }
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao pesquisar usuário:', error);
                alert('Erro ao pesquisar usuário. Verifique a conexão ou tente novamente.');
            }
        });
    }

    if (manageUserForm) {
        manageUserForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const cpf = formCpfInput.value.trim();
            const accessLevel = formAccessLevel.value;
            
            if (!cpf || accessLevel === 'no_access') {
                alert('CPF e Nível de Acesso são obrigatórios.');
                return;
            }

            const action = saveUserButton.textContent === 'Adicionar Novo Usuário' ? 'add' : 'edit';
            const data = { action: action, cpf: cpf, access_level: accessLevel };
            
            if(action === 'add') {
                if (formCpfInput.value === '') {
                    alert('Por favor, insira o CPF para o novo usuário.');
                    return;
                }
            }


            try {
                const response = await fetch('/admin/manage_user', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                alert(result.message);
                if (result.success) {
                    resetUserForm();
                    loadAllDatalistsOptimized();
                    fetchResults('usuarios');
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao salvar usuário:', error);
                alert('Erro ao salvar o usuário. Tente novamente.');
            }
        });
    }


    if (deleteUserButton) {
        deleteUserButton.addEventListener('click', async () => {
            const cpf = formCpfInput.value;
            if (confirm(`Tem certeza que deseja excluir o usuário com CPF ${cpf}? Esta ação é irreversível.`)) {
                try {
                    const response = await fetch('/admin/manage_user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ action: 'delete', cpf: cpf })
                    });
                    const result = await response.json();
                    alert(result.message);
                    if (result.success) {
                        resetUserForm();
                        loadAllDatalistsOptimized();
                        fetchResults('usuarios');
                    }
                } catch (error) {
                    console.error('ERRO JS: Erro ao excluir usuário:', error);
                    alert('Erro ao excluir o usuário.');
                }
            }
        });
    }

    if (newUserButton) {
        newUserButton.addEventListener('click', resetUserForm);
    }
    
    const deleteEntryForm = document.getElementById('deleteEntryForm');
    if (deleteEntryForm) {
        deleteEntryForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const table = document.getElementById('delete-table').value;
            const id = document.getElementById('delete-id').value;

            if (confirm(`Tem certeza que deseja excluir o registro ID ${id} da tabela "${table}"? Esta ação é irreversível!`)) {
                try {
                    const response = await fetch('/admin/delete_entry', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ table, id })
                    });
                    const result = await response.json();
                    alert(result.message);
                    if (result.success) {
                        deleteEntryForm.reset();
                        const currentTableId = document.querySelector('.tab-button.active')?.dataset.tableId;
                        if (currentTableId === table) {
                            fetchResults(table, currentPage[table] || 1);
                        }
                    }
                } catch (error) {
                    console.error('ERRO JS: Erro ao excluir registro individual:', error);
                    alert('Ocorreu um erro ao tentar excluir o registro.');
                }
            }
        });
    }

    if (uploadBaseForm) {
        uploadBaseForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            
            const fileInput = document.getElementById('baseFile');
            const file = fileInput.files[0];
            
            if (!file) {
                alert('Por favor, selecione um arquivo.');
                return;
            }

            const isConfirmed = confirm("ATENÇÃO: Você está prestes a apagar todos os dados da base de participantes e substituí-los. Tem certeza que deseja continuar?");
            if (!isConfirmed) {
                return;
            }

            uploadStatus.textContent = 'Enviando e processando... Isso pode demorar.';

            const formData = new FormData();
            formData.append('baseFile', file);
            
            try {
                const response = await fetch('/upload_base', {
                    method: 'POST',
                    body: formData
                });
                
                const result = await response.json();
                
                if (result.success) {
                    alert(result.message);
                    uploadStatus.textContent = result.message;
                    uploadBaseForm.reset();
                    loadAllDatalistsOptimized();
                } else {
                    alert('Erro no upload: ' + result.message);
                    uploadStatus.textContent = 'Erro: ' + result.message;
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao fazer upload da base:', error);
                alert('Erro ao conectar com o servidor para fazer upload da base.');
                uploadStatus.textContent = 'Erro ao conectar com o servidor.';
            }
        });
    }

    if (visibilityForm) {
        visibilityForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const elementId = document.getElementById('element-select').value;
            const isHidden = document.getElementById('visibility-status').value === 'true';

            try {
                const response = await fetch('/admin/toggle_visibility', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ element_id: elementId, is_hidden: isHidden })
                });
                const result = await response.json();
                alert(result.message);
                if (result.success) {
                    location.reload();
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao alterar a visibilidade:', error);
                alert('Erro ao alterar a visibilidade.');
            }
        });
    }


    const avisoForm = document.getElementById('avisoForm');
    if (avisoForm) {
        fetchAvisoDataForAdmin();

        avisoForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const data = {
                titulo: document.getElementById('aviso-titulo').value,
                conteudo: document.getElementById('aviso-conteudo').value,
                imagem_url: document.getElementById('aviso-imagem-url').value,
            };
            try {
                const response = await fetch('/admin/avisos', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                alert(result.message);
                if (result.success) {
                    fetchAvisoDataForAdmin();
                    fetchAviso();
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao salvar aviso:', error);
                alert('Erro ao salvar aviso.');
            }
        });
    }

    async function fetchAvisoDataForAdmin() {
        try {
            const response = await fetch('/get_aviso');
            const aviso = await response.json();
            const avisoFormH3 = avisoForm.querySelector('h3');

            if (aviso && aviso.titulo && aviso.conteudo) {
                document.getElementById('aviso-titulo').value = aviso.titulo;
                document.getElementById('aviso-conteudo').value = aviso.conteudo;
                document.getElementById('aviso-imagem-url').value = aviso.imagem_url;
                
                if (avisoFormH3) {
                    avisoFormH3.textContent = 'Editar Aviso Existente';
                }
            } else {
                if (avisoFormH3) {
                    avisoFormH3.textContent = 'Criar Novo Aviso';
                }
            }
        } catch (error) {
            console.warn('DEBUG JS: Erro ao carregar aviso para o admin (provavelmente não há aviso cadastrado):', error);
        }
    }


    async function fetchAviso() {
        const avisoModal = document.getElementById('aviso-modal');
        try {
            const response = await fetch('/get_aviso');
            const aviso = await response.json();
            if (aviso && aviso.titulo && aviso.conteudo) {
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
            } else {
                avisoModal.style.display = 'none';
            }
        } catch (error) {
            console.error('ERRO JS: Erro ao carregar aviso:', error);
            avisoModal.style.display = 'none';
        }
    }

    document.getElementById('aviso-close-button').addEventListener('click', () => {
        document.getElementById('aviso-modal').style.display = 'none';
    });

    window.onclick = function(event) {
        const avisoModal = document.getElementById('aviso-modal');
        if (event.target == editModal) {
            window.closeModal();
        }
        if (event.target == avisoModal) {
            avisoModal.style.display = 'none';
        }
    };


    const linkForm = document.getElementById('linkForm');
    const linksAdminListBody = document.querySelector('#links-admin-list tbody');

    async function loadLinksAdmin() {
        try {
            const response = await fetch('/admin/links');
            const links = await response.json();
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

    linksAdminListBody.addEventListener('click', async function(event) {
        if (event.target.classList.contains('edit-link-button')) {
            const linkId = event.target.dataset.id;
            try {
                const response = await fetch(`/admin/links?id=${linkId}`);
                const link = await response.json();
                if (link.length > 0) {
                    document.getElementById('link-id').value = link[0].id;
                    document.getElementById('link-titulo').value = link[0].titulo;
                    document.getElementById('link-descricao').value = link[0].descricao;
                    document.getElementById('link-url').value = link[0].url;
                    document.getElementById('link-imagem-url').value = link[0].imagem_url;
                    linkForm.querySelector('button[type="submit"]').textContent = 'Atualizar Link';
                    document.getElementById('cancelEditLinkButton').style.display = 'inline-block';
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao carregar link para edição:', error);
            }
        } else if (event.target.classList.contains('delete-link-button')) {
            const linkId = event.target.dataset.id;
            if (confirm('Tem certeza que deseja excluir este link?')) {
                try {
                    const response = await fetch('/admin/links', {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: linkId })
                    });
                    const result = await response.json();
                    alert(result.message);
                    if (result.success) {
                        loadLinksAdmin();
                    }
                } catch (error) {
                    console.error('ERRO JS: Erro ao excluir link:', error);
                    alert('Erro ao excluir link.');
                }
            }
        }
    });

    if (linkForm) {
        linkForm.addEventListener('submit', async function(event) {
            event.preventDefault();
            const linkId = document.getElementById('link-id').value;
            const data = {
                titulo: document.getElementById('link-titulo').value,
                descricao: document.getElementById('link-descricao').value,
                url: document.getElementById('link-url').value,
                imagem_url: document.getElementById('link-imagem-url').value,
            };
            const method = linkId ? 'POST' : 'POST';
            const url = '/admin/links';
            if (linkId) {
                data.id = linkId;
            }

            try {
                const response = await fetch(url, {
                    method: method,
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                const result = await response.json();
                alert(result.message);
                if (result.success) {
                    linkForm.reset();
                    document.getElementById('link-id').value = '';
                    linkForm.querySelector('button[type="submit"]').textContent = 'Salvar Link';
                    document.getElementById('cancelEditLinkButton').style.display = 'none';
                    loadLinksAdmin();
                }
            } catch (error) {
                console.error('ERRO JS: Erro ao salvar link:', error);
                alert('Erro ao salvar link.');
            }
        });
        document.getElementById('cancelEditLinkButton').addEventListener('click', () => {
            linkForm.reset();
            document.getElementById('link-id').value = '';
            linkForm.querySelector('button[type="submit"]').textContent = 'Salvar Link';
            document.getElementById('cancelEditLinkButton').style.display = 'none';
        });
    }

    async function loadLinksPage() {
        const linksContainer = document.getElementById('links-container');
        try {
            const response = await fetch('/get_links');
            const links = await response.json();
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


    const clearAllDataButton = document.getElementById('clearAllDataButton');
    if (clearAllDataButton) {
        clearAllDataButton.addEventListener('click', async () => {
            if (confirm('ATENÇÃO: Esta ação é irreversível. Tem certeza que deseja apagar TODOS os dados dos formulários?')) {
                try {
                    const response = await fetch('/admin_tools', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ action: 'clear_all' })
                    });
                    const result = await response.json();
                    if (result.success) {
                        alert(result.message);
                        window.location.reload();
                    } else {
                        alert('Erro ao limpar os dados: ' + result.message);
                    }
                } catch (error) {
                    console.error('ERRO JS: Erro ao limpar os dados:', error);
                    alert('Ocorreu um erro ao tentar limpar os dados.');
                }
            }
        });
    }

    const downloadAllReportsButton = document.getElementById('downloadAllReportsButton');
    const downloadStatus = document.getElementById('downloadStatus');

    if (downloadAllReportsButton) {
        downloadAllReportsButton.addEventListener('click', async () => {
            downloadAllReportsButton.disabled = true;
            downloadAllReportsButton.textContent = 'Gerando Relatórios...';
            downloadStatus.textContent = 'A geração do relatório foi iniciada. Aguarde, o download começará em breve.';

            try {
                const response = await fetch('/download_all_reports_async');
                const result = await response.json();

                if (result.success) {
                    const checkStatusInterval = setInterval(async () => {
                        try {
                            const statusResponse = await fetch('/check_download_status');
                            const statusResult = await statusResponse.json();

                            if (statusResult.status === 'ready') {
                                clearInterval(checkStatusInterval);
                                downloadStatus.textContent = 'Relatório pronto! O download irá começar...';
                                window.location.href = `/download_file/${statusResult.filename}`;
                                
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

    const toggleFormResultButtons = document.querySelectorAll('.toggle-form-result');
    toggleFormResultButtons.forEach(button => {
        button.addEventListener('click', function() {
            const formId = this.dataset.formId;
            const resultId = this.dataset.resultId;

            const formSection = document.getElementById(formId);
            const resultSection = document.getElementById(resultId);

            if (formSection && resultSection) {
                const isFormVisible = formSection.style.display === 'block';
                if (isFormVisible) {
                    formSection.style.display = 'none';
                    resultSection.style.display = 'block';
                    if (resultId === 'controle-ateste') {
                        fetchResults('ateste');
                    } else {
                        const tableId = resultId.split('-')[1];
                        currentPage[tableId] = 1;
                        fetchResults(tableId, 1);
                    }
                    this.textContent = 'Exibir Formulário';
                } else {
                    formSection.style.display = 'block';
                    resultSection.style.display = 'none';
                    this.textContent = 'Ocultar Resultado';
                }
            }
        });
    });


    // ====================================================================
    // Lógica de Autenticação e Exibição Condicional (CORRIGIDO)
    // ====================================================================
    let currentAccessLevel = 'none';

    async function checkAccessAndInitializeUI() {
        console.log("DEBUG JS: Iniciando checkAccessAndInitializeUI...");
        try {
            const response = await fetch('/get_access_level');
            if (!response.ok) {
                console.warn(`DEBUG JS: Falha ao obter nível de acesso (${response.status}). Redirecionando para login.`);
                window.location.href = '/login';
                return;
            }
            const data = await response.json();
            currentAccessLevel = data.access_level;
            console.log("DEBUG JS: Nível de acesso do usuário:", currentAccessLevel);

            const visibilityResponse = await fetch('/get_visibility');
            const visibilityData = await visibilityResponse.json();
            const hiddenElements = visibilityData.hidden_elements || {};
            console.log('DEBUG JS: Elementos ocultos:', hiddenElements);

            document.querySelectorAll('.section').forEach(section => {
                section.style.display = 'none';
            });
            document.querySelectorAll('.tab-button').forEach(button => {
                button.style.display = 'none';
            });
            document.getElementById('aviso-modal').style.display = 'none';

            switch (currentAccessLevel) {
                case 'basic_access':
                    document.getElementById('tab-form-presenca').style.display = 'inline-block';
                    document.getElementById('tab-resultados-presenca').style.display = 'inline-block';
                    document.getElementById('tab-form-ocorrencia').style.display = 'inline-block';
                    document.getElementById('tab-resultados-ocorrencias').style.display = 'inline-block';
                    window.showSection('form-presenca');
                    break;
                case 'full_access':
                    document.getElementById('tab-form-presenca').style.display = 'inline-block';
                    document.getElementById('tab-form-acompanhamento').style.display = 'inline-block';
                    document.getElementById('tab-form-avaliacao').style.display = 'inline-block';
                    document.getElementById('tab-form-demandas').style.display = 'inline-block';
                    document.getElementById('tab-resultados-presenca').style.display = 'inline-block';
                    document.getElementById('tab-resultados-acompanhamento').style.display = 'inline-block';
                    document.getElementById('tab-resultados-avaliacao').style.display = 'inline-block';
                    document.getElementById('tab-resultados-demandas').style.display = 'inline-block';
                    document.getElementById('tab-controle-ateste').style.display = 'inline-block';
                    document.getElementById('tab-painel-bi').style.display = 'inline-block';
                    document.getElementById('tab-links-importantes').style.display = 'inline-block';
                    document.getElementById('tab-form-ocorrencia').style.display = 'inline-block';
                    document.getElementById('tab-resultados-ocorrencias').style.display = 'inline-block';
                    window.showSection('form-presenca');
                    break;
                case 'super_admin':
                    document.querySelectorAll('.tab-button').forEach(button => {
                        button.style.display = 'inline-block';
                    });
                    document.getElementById('tab-admin-tools').style.display = 'inline-block';
                    window.showSection('admin-tools');
                    break;
                default:
                    console.warn("DEBUG JS: Nível de acesso desconhecido ou 'none'. Redirecionando para login.");
                    window.location.href = '/login';
                    return;
            }

            document.querySelectorAll('.tab-button').forEach(button => {
                const elementId = button.dataset.sectionId || button.id;
                if (currentAccessLevel !== 'super_admin' && hiddenElements[elementId]) {
                    button.style.display = 'none';
                    const sectionId = button.dataset.sectionId;
                    const section = document.getElementById(sectionId);
                    if (section) {
                        section.style.display = 'none';
                    }
                }
                 button.removeEventListener('click', handleTabClick);
                 button.addEventListener('click', handleTabClick);
            });

            function handleTabClick(event) {
                const button = event.currentTarget;
                const sectionId = button.dataset.sectionId;
                const tableId = button.dataset.tableId;
                window.showSection(sectionId, tableId);
            }
            
            if (currentAccessLevel === 'super_admin') {
                loadLinksAdmin();
                fetchAvisoDataForAdmin();
                fetchResults('usuarios');
                console.log("DEBUG JS: UI configurada para acesso Super Admin.");
            }

            loadAllDatalistsOptimized();
            fetchAviso();

            const headerContent = document.querySelector('.header-content');
            if (headerContent) {
                const existingLogoutButton = headerContent.querySelector('.logout-button');
                if (existingLogoutButton) {
                    existingLogoutButton.remove();
                }

                const logoutButton = document.createElement('button');
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
            console.log("DEBUG JS: checkAccessAndInitializeUI concluído.");

        } catch (error) {
            console.error('ERRO JS: Erro ao verificar o nível de acesso ou inicializar a UI:', error);
            window.location.href = '/login';
        }
    }

    checkAccessAndInitializeUI();

    handleFormSubmit('formPresenca', '/submit_presenca', 'Registro de presença enviado com sucesso!');
    handleFormSubmit('formAcompanhamento', '/submit_acompanhamento', 'Acompanhamento de encontro salvo com sucesso!');
    handleFormSubmit('formAvaliacao', '/submit_avaliacao', 'Avaliação enviada com sucesso!');
    handleFormSubmit('formDemandas', '/submit_demandas', 'Registro de demanda salvo com sucesso!');
    handleFormSubmit('formOcorrencia', '/submit_ocorrencia', 'Ocorrência registrada com sucesso!');
});